import type { OpenFile } from "../App";

interface Props {
  files: OpenFile[];
  activeFilePath: string | null;
  dirtyPaths: Set<string>;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export default function TabBar({
  files,
  activeFilePath,
  dirtyPaths,
  onSelect,
  onClose,
}: Props) {
  return (
    <div className="tab-bar">
      {files.map((f) => (
        <div
          key={f.path}
          className={`tab${f.path === activeFilePath ? " active" : ""}`}
          onClick={() => onSelect(f.path)}
        >
          <span className="tab-name">
            {dirtyPaths.has(f.path) ? "\u2022 " : ""}
            {f.name}
          </span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(f.path);
            }}
          >
            {"\u00D7"}
          </button>
        </div>
      ))}
    </div>
  );
}
