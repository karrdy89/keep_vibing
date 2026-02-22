import pytest

from backend import store


@pytest.fixture(autouse=True)
def temp_data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    monkeypatch.setattr(store, "PROJECTS_FILE", tmp_path / "projects.json")
    monkeypatch.setattr(store, "SETTINGS_FILE", tmp_path / "settings.json")
    return tmp_path


def test_load_projects_empty():
    assert store.load_projects() == []


def test_create_and_load_project(tmp_path):
    project_dir = tmp_path / "myproject"
    project_dir.mkdir()
    p = store.create_project("My Project", str(project_dir))
    assert p["name"] == "My Project"
    assert p["id"].startswith("proj_")

    projects = store.load_projects()
    assert len(projects) == 1
    assert projects[0]["id"] == p["id"]


def test_create_project_deduplicates(tmp_path):
    project_dir = tmp_path / "myproject"
    project_dir.mkdir()
    p1 = store.create_project("A", str(project_dir))
    p2 = store.create_project("B", str(project_dir))
    assert p1["id"] == p2["id"]
    assert len(store.load_projects()) == 1


def test_get_project(tmp_path):
    project_dir = tmp_path / "p1"
    project_dir.mkdir()
    p = store.create_project("P1", str(project_dir))
    assert store.get_project(p["id"]) is not None
    assert store.get_project("nonexistent") is None


def test_delete_project(tmp_path):
    project_dir = tmp_path / "p1"
    project_dir.mkdir()
    p = store.create_project("P1", str(project_dir))
    assert store.delete_project(p["id"]) is True
    assert store.load_projects() == []
    assert store.delete_project("nonexistent") is False


def test_settings():
    assert store.load_settings() == {}
    store.save_settings({"theme": "mocha"})
    assert store.load_settings() == {"theme": "mocha"}
