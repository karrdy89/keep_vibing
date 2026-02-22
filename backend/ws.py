import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.session_manager import get_session, read_from_session, write_to_session, destroy_session

router = APIRouter()


@router.websocket("/ws/{session_id}")
async def websocket_terminal(websocket: WebSocket, session_id: str):
    session = get_session(session_id)
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    await websocket.accept()

    async def pty_to_ws():
        """Read from PTY queue, send to WebSocket."""
        while True:
            data = await read_from_session(session_id)
            if data is None:
                break
            await websocket.send_text(data)

    async def ws_to_pty():
        """Read from WebSocket, write to PTY."""
        try:
            while True:
                data = await websocket.receive_text()
                await write_to_session(session_id, data)
        except WebSocketDisconnect:
            pass

    done, pending = await asyncio.wait(
        [asyncio.create_task(pty_to_ws()), asyncio.create_task(ws_to_pty())],
        return_when=asyncio.FIRST_COMPLETED,
    )
    for task in pending:
        task.cancel()
