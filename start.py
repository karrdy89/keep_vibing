"""keep_vibing 개발 서버 기동 스크립트. backend + frontend 동시 실행."""

import subprocess
import sys
import signal
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT, "frontend")

procs: list[subprocess.Popen] = []


def cleanup(*_):
    for p in procs:
        p.terminate()
    sys.exit(0)


signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

if __name__ == "__main__":
    procs.append(
        subprocess.Popen(
            ["uv", "run", "uvicorn", "backend.app:app", "--reload", "--port", "8000"],
            cwd=ROOT,
        )
    )
    procs.append(
        subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=FRONTEND_DIR,
            shell=True,
        )
    )

    print("Backend:  http://localhost:8000")
    print("Frontend: http://localhost:5173")
    print("Press Ctrl+C to stop.")

    try:
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        cleanup()
