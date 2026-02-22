import pytest
from httpx import ASGITransport, AsyncClient

from backend import auth, store
from backend.app import app


@pytest.fixture(autouse=True)
def temp_data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    monkeypatch.setattr(store, "PROJECTS_FILE", tmp_path / "projects.json")
    monkeypatch.setattr(store, "SETTINGS_FILE", tmp_path / "settings.json")
    monkeypatch.setattr(auth, "USERS_FILE", tmp_path / "users.json")
    monkeypatch.setattr(auth, "SECRET_KEY_FILE", tmp_path / "secret.key")
    return tmp_path


@pytest.fixture
def auth_headers(temp_data_dir):
    auth.ensure_users_file()
    token = auth.create_token("admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# --- Auth ---


async def test_login_success(client, temp_data_dir):
    auth.ensure_users_file()
    res = await client.post("/api/login", json={"username": "admin", "password": "admin"})
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["username"] == "admin"


async def test_login_bad_password(client, temp_data_dir):
    auth.ensure_users_file()
    res = await client.post("/api/login", json={"username": "admin", "password": "wrong"})
    assert res.status_code == 401


async def test_me(client, auth_headers):
    res = await client.get("/api/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["username"] == "admin"


async def test_me_no_token(client):
    res = await client.get("/api/me")
    assert res.status_code == 401


async def test_api_requires_auth(client):
    res = await client.get("/api/projects")
    assert res.status_code == 401


async def test_change_password(client, auth_headers):
    res = await client.put(
        "/api/password",
        json={"old_password": "admin", "new_password": "newpass"},
        headers=auth_headers,
    )
    assert res.status_code == 200

    # Old password should no longer work
    res = await client.post("/api/login", json={"username": "admin", "password": "admin"})
    assert res.status_code == 401

    # New password should work
    res = await client.post("/api/login", json={"username": "admin", "password": "newpass"})
    assert res.status_code == 200


async def test_change_password_wrong_old(client, auth_headers):
    res = await client.put(
        "/api/password",
        json={"old_password": "wrong", "new_password": "newpass"},
        headers=auth_headers,
    )
    assert res.status_code == 400


# --- Projects ---


async def test_create_project(client, auth_headers, tmp_path):
    project_dir = tmp_path / "proj"
    project_dir.mkdir()
    res = await client.post(
        "/api/projects",
        json={"name": "Test", "path": str(project_dir)},
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Test"
    assert data["id"].startswith("proj_")


async def test_create_project_auto_name(client, auth_headers, tmp_path):
    project_dir = tmp_path / "my_cool_project"
    project_dir.mkdir()
    res = await client.post(
        "/api/projects",
        json={"path": str(project_dir)},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "my_cool_project"


async def test_create_project_strips_quotes(client, auth_headers, tmp_path):
    project_dir = tmp_path / "quoted_proj"
    project_dir.mkdir()
    quoted_path = f'"{project_dir}"'
    res = await client.post(
        "/api/projects",
        json={"path": quoted_path},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "quoted_proj"


async def test_create_project_bad_path(client, auth_headers):
    res = await client.post(
        "/api/projects",
        json={"path": "/nonexistent/path"},
        headers=auth_headers,
    )
    assert res.status_code == 400


async def test_list_projects(client, auth_headers, tmp_path):
    project_dir = tmp_path / "proj"
    project_dir.mkdir()
    await client.post(
        "/api/projects",
        json={"name": "Test", "path": str(project_dir)},
        headers=auth_headers,
    )
    res = await client.get("/api/projects", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["has_session"] is False


async def test_delete_project(client, auth_headers, tmp_path):
    project_dir = tmp_path / "proj"
    project_dir.mkdir()
    create_res = await client.post(
        "/api/projects",
        json={"name": "Test", "path": str(project_dir)},
        headers=auth_headers,
    )
    project_id = create_res.json()["id"]
    res = await client.delete(f"/api/projects/{project_id}", headers=auth_headers)
    assert res.status_code == 200

    res = await client.get("/api/projects", headers=auth_headers)
    assert res.json() == []


async def test_delete_nonexistent_project(client, auth_headers):
    res = await client.delete("/api/projects/nonexistent", headers=auth_headers)
    assert res.status_code == 404


# --- Settings ---


async def test_settings(client, auth_headers):
    res = await client.get("/api/settings", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == {}

    res = await client.put(
        "/api/settings", json={"theme": "dracula"}, headers=auth_headers
    )
    assert res.status_code == 200

    res = await client.get("/api/settings", headers=auth_headers)
    assert res.json() == {"theme": "dracula"}


# --- File API ---


async def _create_project(client, auth_headers, tmp_path, name="proj"):
    project_dir = tmp_path / name
    project_dir.mkdir(exist_ok=True)
    await client.post(
        "/api/projects",
        json={"name": "Test", "path": str(project_dir)},
        headers=auth_headers,
    )
    return project_dir


async def test_list_files(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    (project_dir / "hello.py").write_text("print('hi')")
    (project_dir / "sub").mkdir()

    res = await client.get(
        f"/api/files?path={project_dir}", headers=auth_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]["is_dir"] is True
    assert data[1]["name"] == "hello.py"


async def test_list_files_excludes_hidden(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    (project_dir / "node_modules").mkdir()
    (project_dir / "__pycache__").mkdir()
    (project_dir / "app.py").write_text("")

    res = await client.get(
        f"/api/files?path={project_dir}", headers=auth_headers
    )
    names = [e["name"] for e in res.json()]
    assert "node_modules" not in names
    assert "__pycache__" not in names
    assert "app.py" in names


async def test_list_files_forbidden_path(client, auth_headers, tmp_path):
    await _create_project(client, auth_headers, tmp_path)
    res = await client.get(f"/api/files?path={tmp_path}", headers=auth_headers)
    assert res.status_code == 403


async def test_read_file(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    (project_dir / "test.txt").write_text("hello world")

    res = await client.get(
        f"/api/files/content?path={project_dir / 'test.txt'}",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "text"
    assert data["content"] == "hello world"


async def test_read_file_not_found(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    res = await client.get(
        f"/api/files/content?path={project_dir / 'nope.txt'}",
        headers=auth_headers,
    )
    assert res.status_code == 404


async def test_write_file(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    file_path = project_dir / "test.txt"
    file_path.write_text("old")

    res = await client.put(
        "/api/files/content",
        json={"path": str(file_path), "content": "new content"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert file_path.read_text() == "new content"


# --- File CRUD ---


async def test_create_file(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    new_file = project_dir / "new.txt"

    res = await client.post(
        "/api/files",
        json={"path": str(new_file), "type": "file"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert new_file.exists()


async def test_create_directory(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    new_dir = project_dir / "newdir"

    res = await client.post(
        "/api/files",
        json={"path": str(new_dir), "type": "directory"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert new_dir.is_dir()


async def test_create_file_already_exists(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    existing = project_dir / "existing.txt"
    existing.write_text("hi")

    res = await client.post(
        "/api/files",
        json={"path": str(existing), "type": "file"},
        headers=auth_headers,
    )
    assert res.status_code == 409


async def test_delete_file(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    target = project_dir / "todelete.txt"
    target.write_text("bye")

    res = await client.delete(
        f"/api/files?path={target}", headers=auth_headers
    )
    assert res.status_code == 200
    assert not target.exists()


async def test_delete_nonempty_dir(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    sub = project_dir / "sub"
    sub.mkdir()
    (sub / "file.txt").write_text("content")

    res = await client.delete(
        f"/api/files?path={sub}", headers=auth_headers
    )
    assert res.status_code == 200
    assert not sub.exists()


async def test_rename_file(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    original = project_dir / "old_name.txt"
    original.write_text("content")

    res = await client.patch(
        "/api/files",
        json={"path": str(original), "new_name": "new_name.txt"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert not original.exists()
    assert (project_dir / "new_name.txt").exists()


async def test_rename_file_conflict(client, auth_headers, tmp_path):
    project_dir = await _create_project(client, auth_headers, tmp_path)
    (project_dir / "a.txt").write_text("a")
    (project_dir / "b.txt").write_text("b")

    res = await client.patch(
        "/api/files",
        json={"path": str(project_dir / "a.txt"), "new_name": "b.txt"},
        headers=auth_headers,
    )
    assert res.status_code == 409
