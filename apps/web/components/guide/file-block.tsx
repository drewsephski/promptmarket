import { CopyButton } from "../copy-button";

interface FileBlockProps {
  filename: string;
  code: string;
}

export function FileBlock({ filename, code }: FileBlockProps) {
  return (
    <figure className="file-block">
      <figcaption>
        <span>{filename}</span>
        <CopyButton value={code} label={`Copy ${filename}`} />
      </figcaption>
      <pre className="guide-code">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
