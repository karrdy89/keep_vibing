import sys

import pytest

from backend.pty_wrapper import PtyWrapper


@pytest.fixture
def pty():
    if sys.platform == "win32":
        proc = PtyWrapper.spawn("cmd.exe", dimensions=(24, 80))
    else:
        proc = PtyWrapper.spawn("/bin/sh", dimensions=(24, 80))
    yield proc
    try:
        proc.terminate(force=True)
    except Exception:
        pass


def test_spawn_and_isalive(pty):
    assert pty.isalive()


def test_write_and_read(pty):
    if sys.platform == "win32":
        pty.write("echo hello\r\n")
    else:
        pty.write("echo hello\n")

    output = ""
    for _ in range(50):
        try:
            data = pty.read()
            output += data
            if "hello" in output:
                break
        except EOFError:
            break

    assert "hello" in output


def test_setwinsize(pty):
    pty.setwinsize(40, 100)


def test_terminate(pty):
    pty.terminate(force=True)
    # After termination, isalive should return False (may take a moment)
    import time

    time.sleep(0.5)
    assert not pty.isalive()
