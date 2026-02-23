import os
import sys


class PtyWrapper:
    """Platform-independent PTY wrapper.

    Windows: winpty.PtyProcess
    Mac/Linux: pexpect.spawn
    """

    def __init__(self, process):
        self._process = process
        self._is_windows = sys.platform == "win32"

    @classmethod
    def spawn(cls, command: str, *, cwd: str | None = None, dimensions: tuple[int, int] = (24, 120)):
        if sys.platform == "win32":
            from winpty import PtyProcess

            proc = PtyProcess.spawn(command, cwd=cwd, dimensions=dimensions)
        else:
            import pexpect

            proc = pexpect.spawn(command, cwd=cwd, encoding=None)
            proc.setwinsize(*dimensions)

        return cls(proc)

    def read(self) -> str:
        if self._is_windows:
            return self._process.read()
        else:
            try:
                data = os.read(self._process.child_fd, 65536)
            except OSError:
                raise EOFError("PTY EOF")
            if not data:
                raise EOFError("PTY EOF")
            return data.decode("utf-8", errors="replace")

    def write(self, data: str) -> None:
        if self._is_windows:
            self._process.write(data)
        else:
            self._process.send(data)

    def setwinsize(self, rows: int, cols: int) -> None:
        self._process.setwinsize(rows, cols)

    def terminate(self, *, force: bool = False) -> None:
        self._process.terminate(force=force)

    def isalive(self) -> bool:
        return self._process.isalive()
