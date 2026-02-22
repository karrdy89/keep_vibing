import { useState } from "react";

interface Props {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onStartSession: (sessionId: string) => void;
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  onStartSession,
}: Props) {
  const [directory, setDirectory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleStartSession() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: directory }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create session");
      }
      const data = await res.json();
      onStartSession(data.session_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? "\u25B6" : "\u25C0"}
        </button>
        {!isCollapsed && <span className="sidebar-title">keep_vibing</span>}
      </div>
      {!isCollapsed && (
        <div className="sidebar-content">
          <div className="sidebar-section">
            <label className="sidebar-label">Project Path</label>
            <input
              className="sidebar-input"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStartSession()}
              placeholder="C:\path\to\project"
            />
            <button
              className="sidebar-button"
              onClick={handleStartSession}
              disabled={!directory || loading}
            >
              {loading ? "Starting..." : "Start Session"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
