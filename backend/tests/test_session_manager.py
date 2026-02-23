import asyncio

import pytest

from backend.session_manager import (
    OUTPUT_BUFFER_MAX,
    Session,
    destroy_session,
    get_output_buffer,
    register_client,
    sessions,
    unregister_client,
)


class FakePty:
    def __init__(self):
        self.is_alive = True

    def read(self):
        raise EOFError

    def write(self, data):
        pass

    def setwinsize(self, rows, cols):
        pass

    def terminate(self, force=False):
        self.is_alive = False


def _make_session(session_id="test-session", project_id="proj_1") -> Session:
    return Session(
        session_id=session_id,
        project_id=project_id,
        directory="/tmp/test",
        pty_process=FakePty(),
    )


@pytest.fixture(autouse=True)
def clean_sessions():
    sessions.clear()
    yield
    sessions.clear()


def test_output_buffer_empty():
    session = _make_session()
    sessions[session.session_id] = session
    assert get_output_buffer(session.session_id) == ""


def test_output_buffer_stores_data():
    session = _make_session()
    sessions[session.session_id] = session
    session.output_buffer.append("hello")
    session.output_buffer_size += 5
    session.output_buffer.append(" world")
    session.output_buffer_size += 6
    assert get_output_buffer(session.session_id) == "hello world"


def test_output_buffer_trims_when_over_limit():
    session = _make_session()
    sessions[session.session_id] = session

    chunk = "x" * 1024
    count = (OUTPUT_BUFFER_MAX // 1024) + 10

    for _ in range(count):
        session.output_buffer.append(chunk)
        session.output_buffer_size += len(chunk)
        while session.output_buffer_size > OUTPUT_BUFFER_MAX and session.output_buffer:
            removed = session.output_buffer.pop(0)
            session.output_buffer_size -= len(removed)

    assert session.output_buffer_size <= OUTPUT_BUFFER_MAX


def test_output_buffer_nonexistent_session():
    assert get_output_buffer("nonexistent") == ""


def test_register_client():
    session = _make_session()
    sessions[session.session_id] = session

    q = register_client(session.session_id)
    assert q is not None
    assert q in session.output_queues


def test_register_client_nonexistent():
    q = register_client("nonexistent")
    assert q is None


def test_register_multiple_clients():
    session = _make_session()
    sessions[session.session_id] = session

    q1 = register_client(session.session_id)
    q2 = register_client(session.session_id)
    assert len(session.output_queues) == 2
    assert q1 is not q2


def test_unregister_client():
    session = _make_session()
    sessions[session.session_id] = session

    q = register_client(session.session_id)
    assert len(session.output_queues) == 1

    unregister_client(session.session_id, q)
    assert len(session.output_queues) == 0


def test_unregister_client_idempotent():
    session = _make_session()
    sessions[session.session_id] = session

    q = register_client(session.session_id)
    unregister_client(session.session_id, q)
    unregister_client(session.session_id, q)
    assert len(session.output_queues) == 0


def test_unregister_client_nonexistent_session():
    q = asyncio.Queue()
    unregister_client("nonexistent", q)


@pytest.mark.asyncio
async def test_destroy_session_signals_all_queues():
    session = _make_session()
    sessions[session.session_id] = session

    q1 = register_client(session.session_id)
    q2 = register_client(session.session_id)

    await destroy_session(session.session_id)

    assert q1.get_nowait() is None
    assert q2.get_nowait() is None
    assert session.session_id not in sessions
