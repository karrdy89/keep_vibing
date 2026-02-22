import { useState, useCallback } from "react";
import Terminal from "./Terminal";
import Sidebar from "./components/Sidebar";
import EditorPanel from "./components/EditorPanel";
import ResizeHandle from "./components/ResizeHandle";

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 500;
const SIDEBAR_COLLAPSED_WIDTH = 48;
const EDITOR_RATIO_MIN = 0.2;
const EDITOR_RATIO_MAX = 0.8;
const DEFAULT_SIDEBAR_WIDTH = 280;

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editorRatio, setEditorRatio] = useState(0.5);
  const [prevSidebarWidth, setPrevSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);

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

  return (
    <div className="app">
      <div className="layout">
        <div className="sidebar-wrapper" style={{ width: currentSidebarWidth }}>
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            onStartSession={setSessionId}
          />
        </div>

        {!sidebarCollapsed && (
          <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
        )}

        <div className="right-panel">
          <div className="editor-wrapper" style={{ flex: editorRatio }}>
            <EditorPanel />
          </div>

          <ResizeHandle direction="vertical" onResize={handleEditorResize} />

          <div className="terminal-wrapper" style={{ flex: 1 - editorRatio }}>
            {sessionId ? (
              <Terminal sessionId={sessionId} />
            ) : (
              <div className="terminal-placeholder">
                Start a session from the sidebar
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
