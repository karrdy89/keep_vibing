from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import router as api_router
from backend.auth import ensure_users_file
from backend.ws import router as ws_router
from backend.session_manager import shutdown_all_sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_users_file()
    yield
    await shutdown_all_sessions()


app = FastAPI(title="keep_vibing", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.include_router(ws_router)
