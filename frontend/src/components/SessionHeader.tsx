interface Props {
  projectName: string;
}

export default function SessionHeader({ projectName }: Props) {
  return (
    <div className="session-header">
      <span className="session-dot" />
      <span>Session: {projectName}</span>
    </div>
  );
}
