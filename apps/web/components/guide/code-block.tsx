interface CodeBlockProps {
  code: string;
  label?: string;
}

export function CodeBlock({ code, label }: CodeBlockProps) {
  return (
    <pre className="guide-code" aria-label={label}>
      <code>{code}</code>
    </pre>
  );
}
