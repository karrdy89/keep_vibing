import { useState, useCallback, useEffect } from "react";
import { api, getToken, type Project } from "./api";
import { getTheme, applyTheme, type Theme } from "./themes";
import Terminal from "./Terminal";
import Sidebar from "./components/Sidebar";
import EditorPanel from "./components/EditorPanel";
import SessionHeader from "./components/SessionHeader";
import ResizeHandle from "./components/ResizeHandle";
import LoginPage from "./components/LoginPage";
import BottomTabBar from "./components/BottomTabBar";

type MobilePanel = "files" | "editor" | "terminal";

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 500;
const SIDEBAR_COLLAPSED_WIDTH = 48;
const EDITOR_RATIO_MIN = 0.2;
const EDITOR_RATIO_MAX = 0.8;
const DEFAULT_SIDEBAR_WIDTH = 280;

export interface OpenFile {
  path: string;
  name: string;
}

function useBreakpoint() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return { isMobile: width < 640, isTablet: width >= 640 && width < 1024 };
}

function App() {
  // Initialize: if no token, immediately show login; if token exists, null = pending verification
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(
    getToken() ? null : false,
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<Theme>(getTheme("catppuccin-mocha"));
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editorRatio, setEditorRatio] = useState(0.5);
  const [prevSidebarWidth, setPrevSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [activePanel, setActivePanel] = useState<MobilePanel>("terminal");
  const [tabletSidebarOpen, setTabletSidebarOpen] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const sessionId = activeProject?.session_id ?? null;

  // Verify token on mount (only runs if token exists since isLoggedIn starts as null)
  useEffect(() => {
    if (isLoggedIn !== null) return;
    const timeout = setTimeout(() => setIsLoggedIn(false), 3000);
    api.me()
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false))
      .finally(() => clearTimeout(timeout));
  }, [isLoggedIn]);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch {
      // ignore fetch errors on refresh
    }
  }, []);

  // Load projects and settings after login
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    api.listProjects().then((data) => {
      if (!cancelled) setProjects(data);
    }).catch(() => {});

    api.me(); // validate token
    fetch("/api/settings", {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then((r) => r.json()).then((settings) => {
      if (!cancelled && settings.theme) {
        const theme = getTheme(settings.theme);
        setCurrentTheme(theme);
        applyTheme(theme);
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [isLoggedIn]);

  // Apply theme on change
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  function handleChangeTheme(themeId: string) {
    const theme = getTheme(themeId);
    setCurrentTheme(theme);
    fetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ theme: themeId }),
    }).catch(() => {});
  }

  function handleSelectProject(project: Project) {
    setActiveProjectId(project.id);
  }

  function handleSelectFile(path: string) {
    const name = path.split("/").pop() ?? path;
    if (!openFiles.some((f) => f.path === path)) {
      setOpenFiles((prev) => [...prev, { path, name }]);
    }
    setActiveFilePath(path);
    if (isMobile) setActivePanel("editor");
    if (isTablet) setTabletSidebarOpen(false);
  }

  function handleCloseFile(path: string) {
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f.path !== path);
      if (activeFilePath === path) {
        setActiveFilePath(next.length > 0 ? next[next.length - 1].path : null);
      }
      return next;
    });
  }

  const handleSidebarResize = useCallback(
    (delta: number) => {
      if (sidebarCollapsed) return;
      setSidebarWidth((w) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w + delta)));
    },
    [sidebarCollapsed],
  );

  const handleEditorResize = useCallback((delta: number) => {
    setEditorRatio((ratio) => {
      const container = document.querySelector(".right-panel");
      if (!container) return ratio;
      const height = container.clientHeight;
      const newRatio = ratio + delta / height;
      return Math.min(EDITOR_RATIO_MAX, Math.max(EDITOR_RATIO_MIN, newRatio));
    });
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      if (!collapsed) {
        setPrevSidebarWidth(sidebarWidth);
      } else {
        setSidebarWidth(prevSidebarWidth);
      }
      return !collapsed;
    });
  }, [sidebarWidth, prevSidebarWidth]);

  const currentSidebarWidth = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : sidebarWidth;

  // Auth check pending
  if (isLoggedIn === null) {
    return null;
  }

  // Not logged in
  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  const sidebarElement = (
    <Sidebar
      isCollapsed={false}
      onToggleCollapse={isTablet ? () => setTabletSidebarOpen(false) : handleToggleSidebar}
      projects={projects}
      activeProjectId={activeProjectId}
      currentThemeId={currentTheme.id}
      onRefreshProjects={refreshProjects}
      onSelectProject={handleSelectProject}
      onSelectFile={handleSelectFile}
      onChangeTheme={handleChangeTheme}
    />
  );

  const editorElement = (
    <EditorPanel
      openFiles={openFiles}
      activeFilePath={activeFilePath}
      monacoTheme={currentTheme.monacoTheme}
      onSelectFile={setActiveFilePath}
      onCloseFile={handleCloseFile}
    />
  );

  const terminalElement = (
    <>
      {sessionId && activeProject && (
        <SessionHeader projectName={activeProject.name} />
      )}
      {projects
        .filter((p) => p.session_id)
        .map((p) => (
          <div
            key={p.session_id}
            style={{
              display: p.session_id === sessionId ? "contents" : "none",
            }}
          >
            <Terminal sessionId={p.session_id!} theme={currentTheme} />
          </div>
        ))}
      {!sessionId && (
        <div className="terminal-placeholder">
          {activeProject
            ? "Start a session to begin"
            : "Select a project from the sidebar"}
        </div>
      )}
    </>
  );

  // --- Mobile layout (< 640px) ---
  if (isMobile) {
    return (
      <div className="app">
        <div className="mobile-layout">
          <div className="mobile-panel" style={{ display: activePanel === "files" ? "flex" : "none" }}>
            {sidebarElement}
          </div>
          <div className="mobile-panel" style={{ display: activePanel === "editor" ? "flex" : "none" }}>
            {editorElement}
          </div>
          <div className="mobile-panel" style={{ display: activePanel === "terminal" ? "flex" : "none" }}>
            {terminalElement}
          </div>
          <BottomTabBar activePanel={activePanel} onChangePanel={setActivePanel} />
        </div>
      </div>
    );
  }

  // --- Tablet layout (640px ~ 1023px) ---
  if (isTablet) {
    return (
      <div className="app">
        {tabletSidebarOpen && (
          <div className="tablet-sidebar-overlay" onClick={() => setTabletSidebarOpen(false)}>
            <div className="tablet-sidebar" onClick={(e) => e.stopPropagation()}>
              {sidebarElement}
            </div>
          </div>
        )}
        <div className="tablet-layout">
          <button className="tablet-sidebar-toggle" onClick={() => setTabletSidebarOpen(true)}>
            ☰
          </button>
          <div className="tablet-editor-wrapper">
            {editorElement}
          </div>
          <ResizeHandle direction="vertical" onResize={handleEditorResize} />
          <div className="tablet-terminal-wrapper">
            {terminalElement}
          </div>
        </div>
      </div>
    );
  }

  // --- Desktop layout (>= 1024px) ---
  return (
    <div className="app">
      <div className="layout">
        <div className="sidebar-wrapper" style={{ width: currentSidebarWidth }}>
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            projects={projects}
            activeProjectId={activeProjectId}
            currentThemeId={currentTheme.id}
            onRefreshProjects={refreshProjects}
            onSelectProject={handleSelectProject}
            onSelectFile={handleSelectFile}
            onChangeTheme={handleChangeTheme}
          />
        </div>

        {!sidebarCollapsed && (
          <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
        )}

        <div className="right-panel">
          <div className="editor-wrapper" style={{ flex: editorRatio }}>
            {editorElement}
          </div>

          <ResizeHandle direction="vertical" onResize={handleEditorResize} />

          <div className="terminal-wrapper" style={{ flex: 1 - editorRatio }}>
            {terminalElement}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
