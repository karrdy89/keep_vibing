import { useState, useEffect } from "react";
import { getToken } from "../api";

interface Props {
  filePath: string;
}

interface ImageState {
  path: string;
  src: string | null;
  error: boolean;
}

export default function ImageViewer({ filePath }: Props) {
  const [result, setResult] = useState<ImageState>({ path: "", src: null, error: false });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const token = getToken();
    fetch(`/api/files/raw?path=${encodeURIComponent(filePath)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResult({ path: filePath, src: objectUrl, error: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ path: filePath, src: null, error: true });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filePath]);

  if (result.path !== filePath) {
    return <div className="image-viewer">Loading...</div>;
  }

  if (result.error) {
    return <div className="image-viewer">Failed to load image</div>;
  }

  return (
    <div className="image-viewer">
      <img src={result.src!} alt={filePath.split("/").pop()} />
    </div>
  );
}
