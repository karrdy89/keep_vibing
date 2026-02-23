import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { Theme } from "./themes";
import { getToken } from "./api";
import { readText } from "./clipboard";
import TerminalToolbar from "./components/TerminalToolbar";

interface Props {
  sessionId: string;
  theme: Theme;
  onSessionEnd?: () => void;
}

const RESIZE_PREFIX = "\x01RESIZE:";

export default function Terminal({ sessionId, theme, onSessionEnd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onSessionEndRef = useRef(onSessionEnd);
  useEffect(() => {
    onSessionEndRef.current = onSessionEnd;
  });

  // Create terminal + WebSocket (only on sessionId change)
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      theme: theme.xtermTheme,
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = getToken();
    const wsUrl = `${protocol}//${window.location.host}/ws/${sessionId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    function sendResize() {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`${RESIZE_PREFIX}${term.cols},${term.rows}`);
      }
    }

    ws.onopen = () => {
      const attachAddon = new AttachAddon(ws, { bidirectional: true });
      term.loadAddon(attachAddon);
      // 연결 직후 현재 크기 전송
      sendResize();
    };

    ws.onclose = () => {
      term.writeln("\r\n\x1b[31m[Session ended]\x1b[0m");
      onSessionEndRef.current?.();
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fitAddon.fit();
        sendResize();
      }, 100);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      termRef.current = null;
      wsRef.current = null;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      term.dispose();
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle paste events on the terminal container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onPaste(e: ClipboardEvent) {
      const text = e.clipboardData?.getData("text");
      if (text) {
        e.preventDefault();
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(text);
        }
      }
    }

    container.addEventListener("paste", onPaste);
    return () => container.removeEventListener("paste", onPaste);
  }, [sessionId]);

  // Mobile touch scroll for xterm (with inertia)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let accumulatedDelta = 0;
    const LINE_HEIGHT = 10;
    const FRICTION = 0.95;
    const MIN_VELOCITY = 0.3;

    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let animationId: number | null = null;
    let prevTimestamp = 0;

    function stopInertia() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }

    function onTouchStart(e: TouchEvent) {
      stopInertia();
      lastY = e.touches[0].clientY;
      lastTime = Date.now();
      accumulatedDelta = 0;
      velocity = 0;
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const term = termRef.current;
      if (!term) return;

      const now = Date.now();
      const currentY = e.touches[0].clientY;
      const delta = lastY - currentY;
      const dt = now - lastTime;
      if (dt > 0) {
        velocity = delta / dt;
      }
      lastY = currentY;
      lastTime = now;

      accumulatedDelta += delta;
      const lines = Math.trunc(accumulatedDelta / LINE_HEIGHT);
      if (lines !== 0) {
        term.scrollLines(lines);
        accumulatedDelta -= lines * LINE_HEIGHT;
      }
    }

    function onTouchEnd() {
      if (!termRef.current || Math.abs(velocity) < 0.05) return;

      let pxPerMs = velocity;
      let inertiaDelta = 0;
      prevTimestamp = 0;

      function animate(timestamp: number) {
        if (!termRef.current) { animationId = null; return; }
        const dt = prevTimestamp ? timestamp - prevTimestamp : 16;
        prevTimestamp = timestamp;

        const framePx = pxPerMs * dt;
        if (Math.abs(framePx) < MIN_VELOCITY) { animationId = null; return; }

        inertiaDelta += framePx;
        const lines = Math.trunc(inertiaDelta / LINE_HEIGHT);
        if (lines !== 0) {
          termRef.current.scrollLines(lines);
          inertiaDelta -= lines * LINE_HEIGHT;
        }
        pxPerMs *= FRICTION;
        animationId = requestAnimationFrame(animate);
      }
      animationId = requestAnimationFrame(animate);
    }

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      stopInertia();
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [sessionId]);

  // Update theme without recreating terminal/WS
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = theme.xtermTheme;
    }
  }, [theme]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const handleSendKey = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
    termRef.current?.focus();
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text) {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(text);
      }
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", flex: 1, minHeight: 0 }}>
      <div ref={containerRef} style={{ width: "100%", flex: 1, minHeight: 0, overflow: "hidden" }} />
      {isMobile && <TerminalToolbar onSendKey={handleSendKey} onPaste={handlePaste} />}
    </div>
  );
}
