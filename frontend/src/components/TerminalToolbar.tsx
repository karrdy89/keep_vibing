interface Props {
  onSendKey: (data: string) => void;
  onPaste?: () => void;
}

const row1Keys = [
  { label: "Esc", data: "\x1b" },
  { label: "Ctrl+C", data: "\x03" },
  { label: "Ctrl+D", data: "\x04" },
  { label: "Ctrl+E", data: "\x05" },
];

const arrowKeys = [
  { label: "↑", data: "\x1b[A", col: 2, row: 1 },
  { label: "←", data: "\x1b[D", col: 1, row: 2 },
  { label: "↓", data: "\x1b[B", col: 2, row: 2 },
  { label: "→", data: "\x1b[C", col: 3, row: 2 },
];

export default function TerminalToolbar({ onSendKey, onPaste }: Props) {
  return (
    <div className="terminal-toolbar">
      <div className="terminal-toolbar-keys">
        <div className="terminal-toolbar-row">
          {row1Keys.map((k) => (
            <button
              key={k.label}
              className="terminal-toolbar-key"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSendKey(k.data)}
            >
              {k.label}
            </button>
          ))}
          <button
            className="terminal-toolbar-key terminal-toolbar-key-end"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSendKey("\x1b[3~")}
          >
            Del
          </button>
        </div>
        <div className="terminal-toolbar-row">
          <button
            className="terminal-toolbar-key"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSendKey("\t")}
          >
            Tab
          </button>
          {onPaste && (
            <button
              className="terminal-toolbar-key"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onPaste}
            >
              Paste
            </button>
          )}
          <button
            className="terminal-toolbar-key terminal-toolbar-key-end"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSendKey("\r")}
          >
            Enter
          </button>
        </div>
      </div>
      <div className="terminal-toolbar-arrows">
        {arrowKeys.map((k) => (
          <button
            key={k.label}
            className="terminal-toolbar-arrow"
            style={{ gridColumn: k.col, gridRow: k.row }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSendKey(k.data)}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
