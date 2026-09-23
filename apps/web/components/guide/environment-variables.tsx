import { FileBlock } from "./file-block";

interface EnvironmentVariablesProps {
  filename: string;
  value: string;
}

export function EnvironmentVariables({
  filename,
  value,
}: EnvironmentVariablesProps) {
  return <FileBlock filename={filename} code={value} />;
}
