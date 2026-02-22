import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { Theme } from "./themes";
import { getToken } from "./api";

interface Props {
  sessionId: string;
  theme: Theme;
}

export default function Terminal({ sessionId, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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

    ws.onopen = () => {
      const attachAddon = new AttachAddon(ws, { bidirectional: true });
      term.loadAddon(attachAddon);
    };

    ws.onclose = () => {
      term.writeln("\r\n\x1b[31m[Session ended]\x1b[0m");
    };

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      termRef.current = null;
      wsRef.current = null;
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

  return <div ref={containerRef} style={{ width: "100%", height: "100%", flex: 1, minHeight: 0 }} />;
}
