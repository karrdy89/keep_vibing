import { useState, useEffect, useRef } from "react";
import { api } from "../api";

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export default function AddProjectModal({ onClose, onAdded }: Props) {
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit() {
    if (!path.trim()) return;
    setError("");
    setLoading(true);
    try {
      await api.createProject(path.trim().replace(/^["']+|["']+$/g, ""));
      onAdded();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Add Project</span>
          <button className="modal-close" onClick={onClose}>{"\u00D7"}</button>
        </div>
        <div className="modal-body">
          <label className="sidebar-label">Project Path</label>
          <input
            ref={inputRef}
            className="sidebar-input"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="C:\path\to\project"
          />
          {error && <p className="error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="sidebar-button modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="sidebar-button"
            onClick={handleSubmit}
            disabled={!path.trim() || loading}
          >
            {loading ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
