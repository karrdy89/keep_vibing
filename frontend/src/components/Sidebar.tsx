import { useState } from "react";
import type { Project } from "../api";
import ProjectList from "./ProjectList";
import FileTree from "./FileTree";
import SettingsPanel from "./SettingsPanel";
import AddProjectModal from "./AddProjectModal";

interface Props {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  projects: Project[];
  activeProjectId: string | null;
  currentThemeId: string;
  onRefreshProjects: () => void;
  onSelectProject: (project: Project) => void;
  onSelectFile: (path: string) => void;
  onChangeTheme: (themeId: string) => void;
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  projects,
  activeProjectId,
  currentThemeId,
  onRefreshProjects,
  onSelectProject,
  onSelectFile,
  onChangeTheme,
}: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const activeProject = projects.find((p) => p.id === activeProjectId);

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
        {!isCollapsed && (
          <>
            <span className="sidebar-title">keep_vibing</span>
            <button
              className="sidebar-add-btn"
              onClick={() => setShowAddModal(true)}
              title="Add project"
            >
              +
            </button>
          </>
        )}
      </div>
      {!isCollapsed && (
        <div className="sidebar-content">
          <ProjectList
            projects={projects}
            activeProjectId={activeProjectId}
            onRefresh={onRefreshProjects}
            onSelectProject={onSelectProject}
          />
          {activeProject && (
            <div className="sidebar-section file-tree-section">
              <label className="sidebar-label">Files</label>
              <FileTree
                key={activeProject.id}
                rootPath={activeProject.path}
                onSelectFile={onSelectFile}
              />
            </div>
          )}
        </div>
      )}
      {!isCollapsed && (
        <div className="sidebar-footer">
          <button
            className="sidebar-footer-btn"
            onClick={() => setShowSettings(true)}
          >
            {"\u2699"} Settings
          </button>
        </div>
      )}
      {showAddModal && (
        <AddProjectModal
          onClose={() => setShowAddModal(false)}
          onAdded={onRefreshProjects}
        />
      )}
      {showSettings && (
        <SettingsPanel
          currentThemeId={currentThemeId}
          onChangeTheme={onChangeTheme}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
