export interface Theme {
  id: string;
  name: string;
  vars: Record<string, string>;
  monacoTheme: string;
  xtermTheme: {
    background: string;
    foreground: string;
    cursor: string;
  };
}

export const themes: Theme[] = [
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    monacoTheme: "vs-dark",
    xtermTheme: {
      background: "#1e1e2e",
      foreground: "#cdd6f4",
      cursor: "#f5e0dc",
    },
    vars: {
      "--bg-base": "#1e1e2e",
      "--bg-surface": "#181825",
      "--bg-overlay": "#313244",
      "--bg-hover": "#45475a",
      "--fg-primary": "#cdd6f4",
      "--fg-secondary": "#a6adc8",
      "--fg-muted": "#585b70",
      "--accent": "#89b4fa",
      "--accent-hover": "#74c7ec",
      "--success": "#a6e3a1",
      "--danger": "#f38ba8",
      "--border": "#313244",
    },
  },
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    monacoTheme: "vs",
    xtermTheme: {
      background: "#eff1f5",
      foreground: "#4c4f69",
      cursor: "#dc8a78",
    },
    vars: {
      "--bg-base": "#eff1f5",
      "--bg-surface": "#e6e9ef",
      "--bg-overlay": "#ccd0da",
      "--bg-hover": "#bcc0cc",
      "--fg-primary": "#4c4f69",
      "--fg-secondary": "#6c6f85",
      "--fg-muted": "#9ca0b0",
      "--accent": "#1e66f5",
      "--accent-hover": "#209fb5",
      "--success": "#40a02b",
      "--danger": "#d20f39",
      "--border": "#ccd0da",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    monacoTheme: "vs-dark",
    xtermTheme: {
      background: "#282a36",
      foreground: "#f8f8f2",
      cursor: "#f8f8f2",
    },
    vars: {
      "--bg-base": "#282a36",
      "--bg-surface": "#21222c",
      "--bg-overlay": "#44475a",
      "--bg-hover": "#6272a4",
      "--fg-primary": "#f8f8f2",
      "--fg-secondary": "#bd93f9",
      "--fg-muted": "#6272a4",
      "--accent": "#bd93f9",
      "--accent-hover": "#ff79c6",
      "--success": "#50fa7b",
      "--danger": "#ff5555",
      "--border": "#44475a",
    },
  },
];

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0];
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
}
