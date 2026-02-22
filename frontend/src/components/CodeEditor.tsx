import Editor from "@monaco-editor/react";
import { useRef, useCallback } from "react";
import type { editor } from "monaco-editor";

interface Props {
  filePath: string;
  content: string;
  monacoTheme?: string;
  onChange: (value: string) => void;
}

const EXT_TO_LANG: Record<string, string> = {
  ".py": "python",
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".json": "json",
  ".html": "html",
  ".css": "css",
  ".md": "markdown",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".sh": "shell",
  ".bat": "bat",
  ".sql": "sql",
  ".xml": "xml",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".lua": "lua",
};

function getLanguage(path: string): string {
  const ext = "." + path.split(".").pop()?.toLowerCase();
  return EXT_TO_LANG[ext] ?? "plaintext";
}

export default function CodeEditor({ filePath, content, monacoTheme = "vs-dark", onChange }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount = useCallback((ed: editor.IStandaloneCodeEditor) => {
    editorRef.current = ed;
  }, []);

  return (
    <Editor
      height="100%"
      language={getLanguage(filePath)}
      value={content}
      theme={monacoTheme}
      onChange={(val) => onChange(val ?? "")}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'Cascadia Code', 'Consolas', monospace",
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  );
}
