import json
import os
import secrets
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PROJECTS_FILE = DATA_DIR / "projects.json"
SETTINGS_FILE = DATA_DIR / "settings.json"


def _ensure_data_dir():
    DATA_DIR.mkdir(exist_ok=True)


def _read_json(path: Path) -> dict | list:
    if not path.exists():
        return [] if "projects" in path.name else {}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: dict | list):
    _ensure_data_dir()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_projects() -> list[dict]:
    return _read_json(PROJECTS_FILE)


def get_project(project_id: str) -> dict | None:
    for p in load_projects():
        if p["id"] == project_id:
            return p
    return None


def create_project(name: str, path: str) -> dict:
    projects = load_projects()
    normalized = os.path.normpath(path)
    for p in projects:
        if os.path.normpath(p["path"]) == normalized:
            return p
    project = {
        "id": f"proj_{secrets.token_hex(4)}",
        "name": name,
        "path": normalized,
    }
    projects.append(project)
    _write_json(PROJECTS_FILE, projects)
    return project


def delete_project(project_id: str) -> bool:
    projects = load_projects()
    filtered = [p for p in projects if p["id"] != project_id]
    if len(filtered) == len(projects):
        return False
    _write_json(PROJECTS_FILE, filtered)
    return True


def load_settings() -> dict:
    return _read_json(SETTINGS_FILE)


def save_settings(settings: dict):
    _write_json(SETTINGS_FILE, settings)
