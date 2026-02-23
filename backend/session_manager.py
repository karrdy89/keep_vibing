import asyncio
import shutil
import threading
import uuid
from dataclasses import dataclass, field
from threading import Thread

from backend.pty_wrapper import PtyWrapper

OUTPUT_BUFFER_MAX = 100 * 1024  # 100KB


@dataclass
class Session:
    session_id: str
    project_id: str
    directory: str
    pty_process: PtyWrapper
    output_buffer: list[str] = field(default_factory=list)
    output_buffer_size: int = 0
    output_queues: list[asyncio.Queue] = field(default_factory=list)
    lock: threading.Lock = field(default_factory=threading.Lock)
    reader_thread: Thread | None = None
    is_alive: bool = True


sessions: dict[str, Session] = {}


def _find_claude_cli() -> str:
    path = shutil.which("claude")
    if not path:
        raise RuntimeError(
            "claude CLI not found in PATH. Install it first: https://claude.ai/code"
        )
    return path


def _broadcast(session: Session, data, loop: asyncio.AbstractEventLoop):
    """Push data to all registered client queues."""
    with session.lock:
        queues = list(session.output_queues)
    for q in queues:
        asyncio.run_coroutine_threadsafe(q.put(data), loop)


def _pty_reader(session: Session, loop: asyncio.AbstractEventLoop):
    """Background thread: blocking read from PTY, push to async queues."""
    while session.is_alive:
        try:
            data = session.pty_process.read()
            if data:
                with session.lock:
                    session.output_buffer.append(data)
                    session.output_buffer_size += len(data)
                    while session.output_buffer_size > OUTPUT_BUFFER_MAX and session.output_buffer:
                        removed = session.output_buffer.pop(0)
                        session.output_buffer_size -= len(removed)
                _broadcast(session, data, loop)
        except EOFError:
            session.is_alive = False
            _broadcast(session, None, loop)
            break
        except Exception:
            session.is_alive = False
            _broadcast(session, None, loop)
            break


def register_client(session_id: str) -> asyncio.Queue | None:
    """Register a new WebSocket client and return its dedicated queue."""
    session = sessions.get(session_id)
    if not session:
        return None
    q: asyncio.Queue = asyncio.Queue()
    with session.lock:
        session.output_queues.append(q)
    return q


def unregister_client(session_id: str, queue: asyncio.Queue):
    """Remove a client queue from the session."""
    session = sessions.get(session_id)
    if not session:
        return
    with session.lock:
        try:
            session.output_queues.remove(queue)
        except ValueError:
            pass


def get_output_buffer(session_id: str) -> str:
    """Return buffered output history."""
    session = sessions.get(session_id)
    if not session:
        return ""
    with session.lock:
        return "".join(session.output_buffer)


def get_session_by_project(project_id: str) -> Session | None:
    for s in sessions.values():
        if s.project_id == project_id and s.is_alive:
            return s
    return None


async def create_session(project_id: str, directory: str) -> str:
    existing = get_session_by_project(project_id)
    if existing:
        return existing.session_id

    claude_path = _find_claude_cli()
    session_id = uuid.uuid4().hex[:12]

    pty = PtyWrapper.spawn(claude_path, cwd=directory, dimensions=(24, 120))

    session = Session(
        session_id=session_id,
        project_id=project_id,
        directory=directory,
        pty_process=pty,
    )

    loop = asyncio.get_running_loop()
    thread = Thread(target=_pty_reader, args=(session, loop), daemon=True)
    thread.start()
    session.reader_thread = thread

    sessions[session_id] = session
    return session_id


def get_session(session_id: str) -> Session | None:
    return sessions.get(session_id)


async def write_to_session(session_id: str, data: str):
    session = sessions.get(session_id)
    if not session or not session.is_alive:
        return
    await asyncio.to_thread(session.pty_process.write, data)


def resize_session(session_id: str, rows: int, cols: int):
    session = sessions.get(session_id)
    if not session or not session.is_alive:
        return
    try:
        session.pty_process.setwinsize(rows, cols)
    except (OSError, EOFError):
        pass


async def destroy_session(session_id: str):
    session = sessions.pop(session_id, None)
    if not session:
        return
    session.is_alive = False
    with session.lock:
        queues = list(session.output_queues)
    for q in queues:
        try:
            q.put_nowait(None)
        except asyncio.QueueFull:
            pass
    try:
        session.pty_process.terminate(force=True)
    except Exception:
        pass


async def shutdown_all_sessions():
    for sid in list(sessions.keys()):
        await destroy_session(sid)
