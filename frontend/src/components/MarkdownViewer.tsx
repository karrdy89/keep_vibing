import { useState, useMemo } from "react";
import { marked } from "marked";
import CodeEditor from "./CodeEditor";

interface Props {
  filePath: string;
  content: string;
  monacoTheme?: string;
  onChange: (value: string) => void;
}

export default function MarkdownViewer({ filePath, content, monacoTheme, onChange }: Props) {
  const [isPreview, setIsPreview] = useState(true);

  const html = useMemo(() => {
    return marked.parse(content, { async: false }) as string;
  }, [content]);

  return (
    <div className="markdown-viewer">
      <div className="markdown-toolbar">
        <button
          className={`markdown-toggle${!isPreview ? " active" : ""}`}
          onClick={() => setIsPreview(false)}
        >
          Edit
        </button>
        <button
          className={`markdown-toggle${isPreview ? " active" : ""}`}
          onClick={() => setIsPreview(true)}
        >
          Preview
        </button>
      </div>
      <div className="markdown-content">
        {isPreview ? (
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <CodeEditor filePath={filePath} content={content} monacoTheme={monacoTheme} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
