import { useState, useEffect, useCallback } from "react";
import type { OpenFile } from "../App";
import { getToken } from "../api";
import TabBar from "./TabBar";
import CodeEditor from "./CodeEditor";
import MarkdownViewer from "./MarkdownViewer";
import ImageViewer from "./ImageViewer";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp"]);

function getExtension(path: string): string {
  return ("." + path.split(".").pop()?.toLowerCase()) || "";
}

interface Props {
  openFiles: OpenFile[];
  activeFilePath: string | null;
  monacoTheme?: string;
  onSelectFile: (path: string) => void;
  onCloseFile: (path: string) => void;
}

export default function EditorPanel({
  openFiles,
  activeFilePath,
  monacoTheme = "vs-dark",
  onSelectFile,
  onCloseFile,
}: Props) {
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());
  const [loadingPath, setLoadingPath] = useState<string | null>(null);

  const loadFile = useCallback(async (path: string) => {
    if (fileContents[path] !== undefined) return;
    setLoadingPath(path);
    try {
      const token = getToken();
      const res = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.type === "text") {
        setFileContents((prev) => ({ ...prev, [path]: data.content }));
      }
    } finally {
      setLoadingPath(null);
    }
  }, [fileContents]);

  useEffect(() => {
    if (activeFilePath && !IMAGE_EXTENSIONS.has(getExtension(activeFilePath))) {
      loadFile(activeFilePath);
    }
  }, [activeFilePath, loadFile]);

  const handleChange = useCallback((path: string, value: string) => {
    setFileContents((prev) => ({ ...prev, [path]: value }));
    setDirtyPaths((prev) => new Set(prev).add(path));
  }, []);

  const handleSave = useCallback(async (path: string) => {
    const content = fileContents[path];
    if (content === undefined) return;
    const token = getToken();
    const res = await fetch("/api/files/content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ path, content }),
    });
    if (res.ok) {
      setDirtyPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, [fileContents]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeFilePath && dirtyPaths.has(activeFilePath)) {
          handleSave(activeFilePath);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault();
        if (activeFilePath) {
          onCloseFile(activeFilePath);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFilePath, dirtyPaths, handleSave, onCloseFile]);

  if (openFiles.length === 0) {
    return (
      <div className="editor-panel">
        <div className="editor-placeholder">Click a file to open</div>
      </div>
    );
  }

  function renderContent() {
    if (!activeFilePath) {
      return <div className="editor-placeholder">Select a tab</div>;
    }

    const ext = getExtension(activeFilePath);

    if (IMAGE_EXTENSIONS.has(ext)) {
      return <ImageViewer filePath={activeFilePath} />;
    }

    if (loadingPath === activeFilePath) {
      return <div className="editor-placeholder">Loading...</div>;
    }

    const content = fileContents[activeFilePath];
    if (content === undefined) {
      return <div className="editor-placeholder">Loading...</div>;
    }

    if (ext === ".md") {
      return (
        <MarkdownViewer
          filePath={activeFilePath}
          content={content}
          monacoTheme={monacoTheme}
          onChange={(val) => handleChange(activeFilePath, val)}
        />
      );
    }

    return (
      <CodeEditor
        filePath={activeFilePath}
        content={content}
        monacoTheme={monacoTheme}
        onChange={(val) => handleChange(activeFilePath, val)}
      />
    );
  }

  return (
    <div className="editor-panel">
      <TabBar
        files={openFiles}
        activeFilePath={activeFilePath}
        dirtyPaths={dirtyPaths}
        onSelect={onSelectFile}
        onClose={onCloseFile}
      />
      <div className="editor-content">{renderContent()}</div>
    </div>
  );
}
