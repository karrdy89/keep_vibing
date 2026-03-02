interface Props {
  projectName: string;
  agent: "claude" | "codex";
}

export default function SessionHeader({ projectName, agent }: Props) {
  const label = agent === "codex" ? "Codex" : "Claude";
  return (
    <div className="session-header">
      <span className="session-dot" />
      <span>Session: {projectName} ({label})</span>
    </div>
  );
}
