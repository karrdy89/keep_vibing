import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.auth import verify_token
from backend.session_manager import (
    get_output_buffer,
    get_session,
    register_client,
    resize_session,
    unregister_client,
    write_to_session,
)

RESIZE_PREFIX = "\x01RESIZE:"

router = APIRouter()


@router.websocket("/ws/{session_id}")
async def websocket_terminal(websocket: WebSocket, session_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Token required")
        return
    try:
        verify_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    session = get_session(session_id)
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    await websocket.accept()

    # Register this client's dedicated queue
    client_queue = register_client(session_id)
    if not client_queue:
        await websocket.close(code=4004, reason="Session not found")
        return

    # Send buffered history to the new client
    history = get_output_buffer(session_id)
    if history:
        try:
            await websocket.send_text(history)
        except Exception:
            unregister_client(session_id, client_queue)
            return

    # If session already dead, notify and close
    if not session.is_alive:
        try:
            await websocket.close()
        except Exception:
            pass
        unregister_client(session_id, client_queue)
        return

    async def pty_to_ws():
        """Read from client queue, send to WebSocket."""
        while True:
            data = await client_queue.get()
            if data is None:
                break
            try:
                await websocket.send_text(data)
            except Exception:
                break

    async def ws_to_pty():
        """Read from WebSocket, write to PTY."""
        try:
            while True:
                data = await websocket.receive_text()
                if data.startswith(RESIZE_PREFIX):
                    try:
                        parts = data[len(RESIZE_PREFIX):].split(",")
                        cols, rows = int(parts[0]), int(parts[1])
                        resize_session(session_id, rows, cols)
                    except Exception:
                        pass
                else:
                    await write_to_session(session_id, data)
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    done, pending = await asyncio.wait(
        [asyncio.create_task(pty_to_ws()), asyncio.create_task(ws_to_pty())],
        return_when=asyncio.FIRST_COMPLETED,
    )
    for task in pending:
        task.cancel()

    # Cleanup: unregister this client's queue and drain remaining items
    unregister_client(session_id, client_queue)
    while not client_queue.empty():
        try:
            client_queue.get_nowait()
        except asyncio.QueueEmpty:
            break

    # Gracefully close the WebSocket
    try:
        await websocket.close()
    except Exception:
        pass
