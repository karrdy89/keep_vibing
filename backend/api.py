import base64
import os
import shutil

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.auth import authenticate, change_password, create_token, get_current_user
from backend.session_manager import (
    create_session,
    destroy_session,
    get_session_by_project,
    sessions,
)
from backend.store import (
    create_project,
    delete_project,
    get_project,
    load_projects,
    load_settings,
    save_settings,
)

router = APIRouter()


# --- Auth ---


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def api_login(req: LoginRequest) -> dict:
    # authenticate()가 423 HTTPException을 직접 raise할 수 있음 (계정 잠금)
    user = await authenticate(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(user["username"])
    return {"token": token, "username": user["username"]}


@router.get("/me")
async def api_me(user: dict = Depends(get_current_user)) -> dict:
    return user


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.put("/password")
async def api_change_password(
    req: ChangePasswordRequest, user: dict = Depends(get_current_user)
):
    if not await change_password(user["username"], req.old_password, req.new_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    return {"status": "changed"}


# --- Projects ---


class ProjectRequest(BaseModel):
    name: str | None = None
    path: str


@router.post("/projects")
async def api_create_project(
    req: ProjectRequest, _user: dict = Depends(get_current_user)
) -> dict:
    path = os.path.normpath(req.path.strip().strip("\"'"))
    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail=f"Directory not found: {path}")
    name = req.name or os.path.basename(path)
    return create_project(name, path)


@router.get("/projects")
async def api_list_projects(_user: dict = Depends(get_current_user)) -> list[dict]:
    projects = load_projects()
    for p in projects:
        session = get_session_by_project(p["id"])
        p["has_session"] = session is not None
        p["session_id"] = session.session_id if session else None
    return projects


@router.delete("/projects/{project_id}")
async def api_delete_project(project_id: str, _user: dict = Depends(get_current_user)):
    session = get_session_by_project(project_id)
    if session:
        await destroy_session(session.session_id)
    if not delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted"}


# --- Sessions ---


@router.post("/projects/{project_id}/session")
async def api_start_session(
    project_id: str, _user: dict = Depends(get_current_user)
) -> dict:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not os.path.isdir(project["path"]):
        raise HTTPException(status_code=400, detail=f"Directory not found: {project['path']}")
    session_id = await create_session(project_id, project["path"])
    return {"session_id": session_id, "project_id": project_id}


@router.delete("/projects/{project_id}/session")
async def api_stop_session(project_id: str, _user: dict = Depends(get_current_user)):
    session = get_session_by_project(project_id)
    if not session:
        raise HTTPException(status_code=404, detail="No active session for this project")
    await destroy_session(session.session_id)
    return {"status": "terminated"}


@router.get("/sessions")
async def api_list_sessions(_user: dict = Depends(get_current_user)) -> list[dict]:
    return [
        {"session_id": s.session_id, "project_id": s.project_id, "directory": s.directory}
        for s in sessions.values()
        if s.is_alive
    ]


# --- Settings ---


@router.get("/settings")
async def api_get_settings(_user: dict = Depends(get_current_user)) -> dict:
    return load_settings()


@router.put("/settings")
async def api_put_settings(settings: dict, _user: dict = Depends(get_current_user)):
    save_settings(settings)
    return {"status": "saved"}


# --- Files ---

HIDDEN_DIRS = {"node_modules", "__pycache__", ".git", ".venv", ".next", ".cache", "dist"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
TEXT_EXTENSIONS = {
    ".txt", ".md", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".html", ".css",
    ".yml", ".yaml", ".toml", ".cfg", ".ini", ".sh", ".bat", ".ps1", ".env",
    ".sql", ".xml", ".csv", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".hpp",
    ".rb", ".php", ".swift", ".kt", ".scala", ".r", ".lua", ".vim", ".conf",
    ".gitignore", ".dockerignore", ".editorconfig", ".prettierrc", ".eslintrc",
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp"}


def _validate_file_path(requested_path: str) -> str:
    normalized = os.path.normpath(os.path.abspath(requested_path))
    projects = load_projects()
    for p in projects:
        project_root = os.path.normpath(os.path.abspath(p["path"]))
        if normalized == project_root or normalized.startswith(project_root + os.sep):
            return normalized
    raise HTTPException(status_code=403, detail="Path is outside registered projects")


@router.get("/files")
async def api_list_files(
    path: str = Query(...), _user: dict = Depends(get_current_user)
) -> list[dict]:
    validated = _validate_file_path(path)
    if not os.path.isdir(validated):
        raise HTTPException(status_code=400, detail="Not a directory")

    entries = []
    try:
        for entry in os.scandir(validated):
            if entry.name.startswith(".") and entry.name not in (".env",):
                if entry.is_dir() or entry.name not in (".gitignore", ".editorconfig"):
                    continue
            if entry.is_dir() and entry.name in HIDDEN_DIRS:
                continue
            entries.append({
                "name": entry.name,
                "path": entry.path.replace("\\", "/"),
                "is_dir": entry.is_dir(),
            })
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    entries.sort(key=lambda e: (not e["is_dir"], e["name"].lower()))
    return entries


@router.get("/files/content")
async def api_read_file(
    path: str = Query(...), _user: dict = Depends(get_current_user)
) -> dict:
    validated = _validate_file_path(path)
    if not os.path.isfile(validated):
        raise HTTPException(status_code=404, detail="File not found")
    size = os.path.getsize(validated)
    if size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 5MB)")

    ext = os.path.splitext(validated)[1].lower()
    if ext in IMAGE_EXTENSIONS:
        with open(validated, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        return {"type": "image", "encoding": "base64", "content": data, "ext": ext}

    try:
        with open(validated, encoding="utf-8") as f:
            content = f.read()
        return {"type": "text", "content": content}
    except UnicodeDecodeError:
        return {"type": "binary", "content": None}


class FileSaveRequest(BaseModel):
    path: str
    content: str


@router.put("/files/content")
async def api_write_file(req: FileSaveRequest, _user: dict = Depends(get_current_user)):
    validated = _validate_file_path(req.path)
    if not os.path.isfile(validated):
        raise HTTPException(status_code=404, detail="File not found")
    with open(validated, "w", encoding="utf-8") as f:
        f.write(req.content)
    return {"status": "saved"}


@router.get("/files/raw")
async def api_raw_file(
    path: str = Query(...), _user: dict = Depends(get_current_user)
):
    validated = _validate_file_path(path)
    if not os.path.isfile(validated):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(validated)


# --- File CRUD ---


class FileCreateRequest(BaseModel):
    path: str
    type: str  # "file" or "directory"


class FileRenameRequest(BaseModel):
    path: str
    new_name: str


@router.post("/files")
async def api_create_file(
    req: FileCreateRequest, _user: dict = Depends(get_current_user)
):
    validated = _validate_file_path(os.path.dirname(req.path))
    target = os.path.join(validated, os.path.basename(req.path))
    if os.path.exists(target):
        raise HTTPException(status_code=409, detail="Already exists")
    if req.type == "directory":
        os.makedirs(target)
    else:
        with open(target, "w", encoding="utf-8") as f:
            f.write("")
    return {"status": "created", "path": target.replace("\\", "/")}


@router.delete("/files")
async def api_delete_file(
    path: str = Query(...), _user: dict = Depends(get_current_user)
):
    validated = _validate_file_path(path)
    if not os.path.exists(validated):
        raise HTTPException(status_code=404, detail="Not found")
    if os.path.isdir(validated):
        shutil.rmtree(validated)
    else:
        os.remove(validated)
    return {"status": "deleted"}


@router.patch("/files")
async def api_rename_file(
    req: FileRenameRequest, _user: dict = Depends(get_current_user)
):
    validated = _validate_file_path(req.path)
    if not os.path.exists(validated):
        raise HTTPException(status_code=404, detail="Not found")
    parent = os.path.dirname(validated)
    new_path = os.path.join(parent, req.new_name)
    if os.path.exists(new_path):
        raise HTTPException(status_code=409, detail="Name already exists")
    os.rename(validated, new_path)
    return {"status": "renamed", "path": new_path.replace("\\", "/")}


# --- File Copy ---


class FileCopyRequest(BaseModel):
    source: str
    destination: str  # directory to paste into


def _resolve_copy_name(dest_dir: str, name: str, is_dir: bool) -> str:
    """Return a non-conflicting path inside dest_dir for the given name."""
    candidate = os.path.join(dest_dir, name)
    if not os.path.exists(candidate):
        return candidate

    stem, ext = (name, "") if is_dir else os.path.splitext(name)
    counter = 1
    while True:
        new_name = f"{stem} ({counter}){ext}"
        candidate = os.path.join(dest_dir, new_name)
        if not os.path.exists(candidate):
            return candidate
        counter += 1


@router.post("/files/copy")
async def api_copy_file(
    req: FileCopyRequest, _user: dict = Depends(get_current_user)
):
    src = _validate_file_path(req.source)
    dest_dir = _validate_file_path(req.destination)

    if not os.path.exists(src):
        raise HTTPException(status_code=404, detail="Source not found")
    if not os.path.isdir(dest_dir):
        raise HTTPException(status_code=400, detail="Destination is not a directory")

    # Prevent copying a directory into itself or its subdirectory
    norm_src = os.path.normpath(src)
    norm_dest = os.path.normpath(dest_dir)
    if os.path.isdir(src) and (
        norm_dest == norm_src or norm_dest.startswith(norm_src + os.sep)
    ):
        raise HTTPException(status_code=400, detail="Cannot copy directory into itself")

    is_dir = os.path.isdir(src)
    target = _resolve_copy_name(dest_dir, os.path.basename(src), is_dir)

    try:
        if is_dir:
            shutil.copytree(src, target)
        else:
            shutil.copy2(src, target)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    return {"status": "copied", "path": target.replace("\\", "/")}
