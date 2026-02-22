"""keep_vibing 개발 서버 기동 스크립트. backend + frontend 동시 실행."""

import subprocess
import sys
import signal
import os
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT, "frontend")

procs: list[subprocess.Popen] = []


def cleanup(*_):
    for p in procs:
        try:
            p.terminate()
        except OSError:
            pass
    for p in procs:
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill()
    sys.exit(0)


signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

if __name__ == "__main__":
    procs.append(
        subprocess.Popen(
            ["uv", "run", "uvicorn", "backend.app:app", "--port", "8500"],
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

    try:
        while True:
            for p in procs:
                ret = p.poll()
                if ret is not None:
                    print(f"Process (pid={p.pid}) exited with code {ret}, shutting down...")
                    cleanup()
            time.sleep(0.5)
    except KeyboardInterrupt:
        cleanup()
