import { CopyButton } from "./copy-button";

interface CommandBlockProps {
  command: string;
  label: string;
}

export function CommandBlock({ command, label }: CommandBlockProps) {
  return (
    <div className="command">
      <pre>
        <code>{command}</code>
      </pre>
      <CopyButton value={command} label={label} />
    </div>
  );
}
