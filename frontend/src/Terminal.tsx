import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { Theme } from "./themes";
import { getToken } from "./api";
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

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
      {isMobile && <TerminalToolbar onSendKey={handleSendKey} />}
      <div ref={containerRef} style={{ width: "100%", flex: 1, minHeight: 0 }} />
    </div>
  );
}
