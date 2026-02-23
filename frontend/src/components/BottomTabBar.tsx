interface Props {
  activePanel: "files" | "editor" | "terminal";
  onChangePanel: (panel: "files" | "editor" | "terminal") => void;
}

const tabs: { id: "files" | "editor" | "terminal"; label: string; icon: string }[] = [
  { id: "files", label: "Files", icon: "📁" },
  { id: "editor", label: "Editor", icon: "📝" },
  { id: "terminal", label: "Terminal", icon: "⌨" },
];

export default function BottomTabBar({ activePanel, onChangePanel }: Props) {
  return (
    <div className="bottom-tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-tab${activePanel === tab.id ? " active" : ""}`}
          onClick={() => onChangePanel(tab.id)}
        >
          <span className="bottom-tab-icon">{tab.icon}</span>
          <span className="bottom-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
