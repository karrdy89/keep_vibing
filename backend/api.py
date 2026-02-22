import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.session_manager import (
    registered_dirs,
    create_session,
    destroy_session,
    get_session,
    sessions,
)

router = APIRouter()


class DirectoryRequest(BaseModel):
    path: str


class SessionResponse(BaseModel):
    session_id: str
    directory: str


@router.post("/directories")
async def register_directory(req: DirectoryRequest) -> dict:
    path = os.path.normpath(req.path)
    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail=f"Directory not found: {path}")
    registered_dirs[path] = path
    return {"path": path}


@router.get("/directories")
async def list_directories() -> list[dict]:
    return [{"path": p} for p in registered_dirs]


@router.post("/sessions")
async def start_session(req: DirectoryRequest) -> SessionResponse:
    path = os.path.normpath(req.path)
    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail=f"Directory not found: {path}")
    session_id = await create_session(path)
    return SessionResponse(session_id=session_id, directory=path)


@router.get("/sessions")
async def list_sessions() -> list[SessionResponse]:
    return [
        SessionResponse(session_id=sid, directory=s.directory)
        for sid, s in sessions.items()
        if s.is_alive
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    if not get_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    await destroy_session(session_id)
    return {"status": "terminated"}
