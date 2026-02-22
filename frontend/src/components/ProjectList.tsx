import { useState } from "react";
import { api, type Project } from "../api";

interface Props {
  projects: Project[];
  activeProjectId: string | null;
  onRefresh: () => void;
  onSelectProject: (project: Project) => void;
}

export default function ProjectList({
  projects,
  activeProjectId,
  onRefresh,
  onSelectProject,
}: Props) {
  const [error, setError] = useState("");

  async function handleDelete(id: string) {
    try {
      await api.deleteProject(id);
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    }
  }

  async function handleToggleSession(project: Project) {
    setError("");
    try {
      if (project.has_session) {
        await api.stopSession(project.id);
      } else {
        await api.startSession(project.id);
      }
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Session error");
    }
  }

  return (
    <div className="project-list">
      <div className="sidebar-section">
        {projects.map((p) => (
          <div
            key={p.id}
            className={`project-item${p.id === activeProjectId ? " active" : ""}`}
            onClick={() => onSelectProject(p)}
          >
            <span
              className={`project-dot ${p.has_session ? "active" : ""}`}
              title={p.has_session ? "Session active" : "No session"}
            />
            <span className="project-name">{p.name}</span>
            <div className="project-actions">
              <button
                className="project-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSession(p);
                }}
                title={p.has_session ? "Stop session" : "Start session"}
              >
                {p.has_session ? "\u25A0" : "\u25B6"}
              </button>
              <button
                className="project-action-btn delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(p.id);
                }}
                title="Delete project"
              >
                {"\u00D7"}
              </button>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="project-list-empty">No projects yet</div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
