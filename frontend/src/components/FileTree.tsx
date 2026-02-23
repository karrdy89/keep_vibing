import { useState, useCallback, useRef, useEffect } from "react";
import ContextMenu, { type MenuItem } from "./ContextMenu";
import { getToken } from "../api";
import { copyText } from "../clipboard";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface Props {
  rootPath: string;
  onSelectFile: (path: string) => void;
}

interface TreeNode {
  entry: FileEntry;
  children: TreeNode[] | null;
  isOpen: boolean;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type ClipboardEntry = { path: string; isDir: boolean; isCut: boolean };
let _persistedClipboard: ClipboardEntry | null = null;
function persistClipboard(v: ClipboardEntry | null) {
  _persistedClipboard = v;
}

export default function FileTree({ rootPath, onSelectFile }: Props) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [clipboard, setClipboardState] = useState<ClipboardEntry | null>(
    () => _persistedClipboard,
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string>("");

  function setClipboard(v: ClipboardEntry | null) {
    persistClipboard(v);
    setClipboardState(v);
  }
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    isDir: boolean;
    isEmptyArea?: boolean;
  } | null>(null);
  const [inlineInput, setInlineInput] = useState<{
    parentPath: string;
    type: "file" | "directory" | "rename";
    defaultValue?: string;
    originalPath?: string;
  } | null>(null);

  const fetchChildren = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    const entries: FileEntry[] = await res.json();
    return entries.map((entry) => ({
      entry,
      children: null,
      isOpen: false,
    }));
  }, []);

  // Load root on first render
  if (!loaded) {
    setLoaded(true);
    fetchChildren(rootPath).then(setNodes);
  }

  function updateNodeAtPath(
    nodes: TreeNode[],
    targetPath: string,
    updater: (node: TreeNode) => TreeNode,
  ): TreeNode[] {
    return nodes.map((node) => {
      if (node.entry.path === targetPath) return updater(node);
      if (node.children) {
        return { ...node, children: updateNodeAtPath(node.children, targetPath, updater) };
      }
      return node;
    });
  }

  async function refreshDir(dirPath: string) {
    const children = await fetchChildren(dirPath);
    if (dirPath === rootPath) {
      setNodes(children);
    } else {
      setNodes((prev) =>
        updateNodeAtPath(prev, dirPath, (n) => ({ ...n, children, isOpen: true })),
      );
    }
  }

  async function handleToggle(node: TreeNode) {
    if (!node.entry.is_dir) {
      onSelectFile(node.entry.path);
      return;
    }

    if (node.isOpen) {
      setNodes((prev) =>
        updateNodeAtPath(prev, node.entry.path, (n) => ({ ...n, isOpen: false })),
      );
    } else {
      const children = node.children ?? (await fetchChildren(node.entry.path));
      setNodes((prev) =>
        updateNodeAtPath(prev, node.entry.path, (n) => ({
          ...n,
          isOpen: true,
          children,
        })),
      );
    }
  }

  function handleContextMenu(e: React.MouseEvent, path: string, isDir: boolean) {
    e.preventDefault();
    if (_persistedClipboard !== clipboard) {
      setClipboardState(_persistedClipboard);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, path, isDir });
  }

  function handleEmptyAreaContextMenu(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest(".file-tree-item")) return;
    e.preventDefault();
    if (_persistedClipboard !== clipboard) {
      setClipboardState(_persistedClipboard);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, path: rootPath, isDir: true, isEmptyArea: true });
  }

  async function handleCreate(parentPath: string, name: string, type: "file" | "directory") {
    if (!name.trim()) return;
    const fullPath = `${parentPath}/${name}`.replace(/\\/g, "/");
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ path: fullPath, type }),
    });
    if (res.ok) {
      await refreshDir(parentPath);
      if (type === "file") onSelectFile(fullPath);
    }
  }

  async function handleDelete(path: string) {
    const name = path.split("/").pop() ?? path;
    if (!window.confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      const parent = path.substring(0, path.replace(/\\/g, "/").lastIndexOf("/"));
      await refreshDir(parent || rootPath);
    }
  }

  async function handleRename(originalPath: string, newName: string) {
    if (!newName.trim()) return;
    const oldName = originalPath.split("/").pop() ?? "";
    if (newName === oldName) return;
    const res = await fetch("/api/files", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ path: originalPath, new_name: newName }),
    });
    if (res.ok) {
      const parent = originalPath.substring(
        0,
        originalPath.replace(/\\/g, "/").lastIndexOf("/"),
      );
      await refreshDir(parent || rootPath);
    }
  }

  async function handlePaste(destDir: string) {
    if (!clipboard) return;
    const res = await fetch("/api/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ source: clipboard.path, destination: destDir }),
    });
    if (!res.ok) return;

    if (clipboard.isCut) {
      const srcParent = clipboard.path.substring(
        0,
        clipboard.path.replace(/\\/g, "/").lastIndexOf("/"),
      );
      const delRes = await fetch(
        `/api/files?path=${encodeURIComponent(clipboard.path)}`,
        { method: "DELETE", headers: authHeaders() },
      );
      if (delRes.ok) {
        setClipboard(null);
        await refreshDir(srcParent || rootPath);
      }
    }
    await refreshDir(destDir);
  }

  async function handleUploadFiles(targetDir: string, files: FileList | File[]) {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    const res = await fetch(`/api/files/upload?path=${encodeURIComponent(targetDir)}`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    if (res.ok) {
      await refreshDir(targetDir);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.detail || "Upload failed");
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUploadFiles(uploadTargetRef.current, files);
    }
    e.target.value = "";
  }

  const [uploadTrigger, setUploadTrigger] = useState<{ dir: string; id: number } | null>(null);

  useEffect(() => {
    if (uploadTrigger) {
      uploadTargetRef.current = uploadTrigger.dir;
      fileInputRef.current?.click();
    }
  }, [uploadTrigger]);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUploadFiles(rootPath, files);
    }
  }

  function getContextMenuItems(): MenuItem[] {
    if (!contextMenu) return [];
    const { path, isDir, isEmptyArea } = contextMenu;
    const items: MenuItem[] = [];

    if (isDir) {
      items.push({
        label: "New File",
        onClick: () => setInlineInput({ parentPath: path, type: "file" }),
      });
      items.push({
        label: "New Folder",
        onClick: () => setInlineInput({ parentPath: path, type: "directory" }),
      });
      items.push({
        label: "Upload File",
        onClick: () => setUploadTrigger({ dir: path, id: Date.now() }),
      });
      if (clipboard) {
        items.push({
          label: "Paste",
          onClick: () => handlePaste(path),
        });
      }
      if (!isEmptyArea) items.push({ separator: true });
    }

    if (!isEmptyArea) {
      items.push({
        label: "Copy",
        onClick: () => setClipboard({ path, isDir, isCut: false }),
      });
      items.push({
        label: "Cut",
        onClick: () => setClipboard({ path, isDir, isCut: true }),
      });
      items.push({
        label: "Rename",
        onClick: () => {
          const name = path.split("/").pop() ?? "";
          const parent = path.substring(0, path.replace(/\\/g, "/").lastIndexOf("/"));
          setInlineInput({
            parentPath: parent || rootPath,
            type: "rename",
            defaultValue: name,
            originalPath: path,
          });
        },
      });
      items.push({
        label: "Delete",
        onClick: () => handleDelete(path),
      });
      items.push({ separator: true });
      items.push({
        label: "Copy Path",
        onClick: () => copyText(path),
      });
    }

    return items;
  }

  function renderNodes(treeNodes: TreeNode[], depth: number) {
    return treeNodes.map((node) => (
      <div key={node.entry.path}>
        <div
          className="file-tree-item"
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() => handleToggle(node)}
          onContextMenu={(e) => handleContextMenu(e, node.entry.path, node.entry.is_dir)}
        >
          <span className="file-tree-icon">
            {node.entry.is_dir ? (node.isOpen ? "\u25BE" : "\u25B8") : " "}
          </span>
          {inlineInput?.type === "rename" &&
          inlineInput.originalPath === node.entry.path ? (
            <InlineInput
              defaultValue={inlineInput.defaultValue ?? ""}
              onConfirm={(val) => {
                handleRename(node.entry.path, val);
                setInlineInput(null);
              }}
              onCancel={() => setInlineInput(null)}
            />
          ) : (
            <span className="file-tree-name">{node.entry.name}</span>
          )}
        </div>
        {node.isOpen && node.children && (
          <>
            {inlineInput &&
              inlineInput.type !== "rename" &&
              inlineInput.parentPath === node.entry.path && (
                <div
                  className="file-tree-item"
                  style={{ paddingLeft: (depth + 1) * 16 + 8 }}
                >
                  <span className="file-tree-icon">
                    {inlineInput.type === "directory" ? "\u25B8" : " "}
                  </span>
                  <InlineInput
                    defaultValue=""
                    onConfirm={(val) => {
                      handleCreate(node.entry.path, val, inlineInput.type as "file" | "directory");
                      setInlineInput(null);
                    }}
                    onCancel={() => setInlineInput(null)}
                  />
                </div>
              )}
            {renderNodes(node.children, depth + 1)}
          </>
        )}
      </div>
    ));
  }

  return (
    <div
      className={`file-tree${isDragOver ? " file-tree-dragover" : ""}`}
      onContextMenu={handleEmptyAreaContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />
      {nodes.length === 0 && loaded && (
        <div className="file-tree-empty">No files</div>
      )}
      {/* Root-level inline input (new file/folder at root) */}
      {inlineInput &&
        inlineInput.type !== "rename" &&
        inlineInput.parentPath === rootPath && (
          <div className="file-tree-item" style={{ paddingLeft: 8 }}>
            <span className="file-tree-icon">
              {inlineInput.type === "directory" ? "\u25B8" : " "}
            </span>
            <InlineInput
              defaultValue=""
              onConfirm={(val) => {
                handleCreate(rootPath, val, inlineInput.type as "file" | "directory");
                setInlineInput(null);
              }}
              onCancel={() => setInlineInput(null)}
            />
          </div>
        )}
      {renderNodes(nodes, 0)}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function InlineInput({
  defaultValue,
  onConfirm,
  onCancel,
}: {
  defaultValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className="file-tree-inline-input"
      defaultValue={defaultValue}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onConfirm((e.target as HTMLInputElement).value);
        if (e.key === "Escape") onCancel();
      }}
      onBlur={(e) => {
        const val = e.target.value.trim();
        if (val && val !== defaultValue) {
          onConfirm(val);
        } else {
          onCancel();
        }
      }}
    />
  );
}
