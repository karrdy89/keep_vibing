import asyncio
import json
import logging
import os
import secrets
import threading
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, Request

from backend.store import DATA_DIR, _ensure_data_dir

logger = logging.getLogger(__name__)

USERS_FILE = DATA_DIR / "users.json"
SECRET_KEY_FILE = DATA_DIR / "secret.key"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 72
MAX_FAILED_ATTEMPTS = 5


def _get_secret_key() -> str:
    _ensure_data_dir()
    if SECRET_KEY_FILE.exists():
        return SECRET_KEY_FILE.read_text(encoding="utf-8").strip()
    key = secrets.token_hex(32)
    SECRET_KEY_FILE.write_text(key, encoding="utf-8")
    return key


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def _load_users() -> list[dict]:
    if not USERS_FILE.exists():
        return []
    return json.loads(USERS_FILE.read_text(encoding="utf-8"))


def _save_users(users: list[dict]):
    _ensure_data_dir()
    USERS_FILE.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")


def ensure_users_file():
    """users.json이 없거나 비어있으면 기본 계정(admin/admin) 생성."""
    users = _load_users()
    if users:
        return
    default_password = "admin"
    users = [{"username": "admin", "password_hash": hash_password(default_password)}]
    _save_users(users)
    print(f"[auth] Created default account: admin / {default_password}")


def _shutdown_server():
    """계정 잠금 시 서버 프로세스를 종료하여 추가 공격을 차단한다."""
    logger.critical("[auth] Account locked — shutting down server to prevent further attacks.")
    # start.py가 자식 프로세스 종료를 감지하여 frontend도 함께 종료함
    threading.Timer(3.0, lambda: os._exit(1)).start()


async def authenticate(username: str, password: str) -> dict | None:
    users = _load_users()
    for u in users:
        if u["username"] == username:
            if u.get("locked"):
                raise HTTPException(status_code=423, detail="Account locked")

            is_valid = await asyncio.to_thread(verify_password, password, u["password_hash"])
            if is_valid:
                u["failed_attempts"] = 0
                _save_users(users)
                return {"username": u["username"]}

            # 실패 횟수 증가
            u["failed_attempts"] = u.get("failed_attempts", 0) + 1
            if u["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
                u["locked"] = True
                _save_users(users)
                _shutdown_server()
                raise HTTPException(status_code=423, detail="Account locked")
            _save_users(users)
            return None
    return None


async def change_password(username: str, old_password: str, new_password: str) -> bool:
    users = _load_users()
    for u in users:
        if u["username"] == username:
            is_valid = await asyncio.to_thread(verify_password, old_password, u["password_hash"])
            if not is_valid:
                return False
            u["password_hash"] = await asyncio.to_thread(hash_password, new_password)
            _save_users(users)
            return True
    return False


def create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, _get_secret_key(), algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"username": username}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    return verify_token(token)
