import { useEffect, useRef } from "react";

export type MenuItem =
  | { label: string; onClick: () => void }
  | { separator: true };

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
      {items.map((item, i) => {
        if ("separator" in item) {
          return <div key={`sep-${i}`} className="context-menu-separator" />;
        }
        return (
          <button
            key={item.label}
            className="context-menu-item"
            onClick={() => {
              try {
                item.onClick();
              } finally {
                onClose();
              }
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
