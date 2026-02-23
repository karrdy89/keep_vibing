interface Props {
  onSendKey: (data: string) => void;
  onPaste?: () => void;
}

const keys = [
  { label: "Tab", data: "\t" },
  { label: "Ctrl+C", data: "\x03" },
  { label: "Ctrl+D", data: "\x04" },
  { label: "↑", data: "\x1b[A" },
  { label: "↓", data: "\x1b[B" },
  { label: "Esc", data: "\x1b" },
];

export default function TerminalToolbar({ onSendKey, onPaste }: Props) {
  return (
    <div className="terminal-toolbar">
      {keys.map((k) => (
        <button
          key={k.label}
          className="terminal-toolbar-key"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSendKey(k.data)}
        >
          {k.label}
        </button>
      ))}
      {onPaste && (
        <button
          className="terminal-toolbar-key"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onPaste}
        >
          Paste
        </button>
      )}
    </div>
  );
}
