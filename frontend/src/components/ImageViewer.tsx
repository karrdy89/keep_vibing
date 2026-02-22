interface Props {
  filePath: string;
}

export default function ImageViewer({ filePath }: Props) {
  const src = `/api/files/raw?path=${encodeURIComponent(filePath)}`;

  return (
    <div className="image-viewer">
      <img src={src} alt={filePath.split("/").pop()} />
    </div>
  );
}
