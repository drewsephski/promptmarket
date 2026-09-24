import type { ProjectContext } from "@promptmarket/content";

export const PROMPTMARKET_MCP_URL = "https://promptmarket.sh/mcp";

export type SetupMode = "dry-run" | "write" | "remove" | "check";

export type FileChange = {
  file: string;
  action: "create" | "update" | "remove" | "unchanged" | "missing";
  lines: string[];
};

export type SetupReport = {
  mode: SetupMode;
  agentName?: string;
  changes: FileChange[];
  checks: string[];
  projectLines: string[];
  ready: boolean;
  agentHint: boolean;
};

function majorOf(version: string | undefined): string | undefined {
  return version?.split(".")[0];
}

function withVersion(label: string, version: string | undefined): string {
  const major = majorOf(version);
  return major ? `${label} ${major}` : label;
}

export function projectCheckLines(project: ProjectContext): string[] {
  const lines: string[] = [];
  if (project.framework) {
    lines.push(project.framework);
  }
  if (project.ai?.sdk) {
    lines.push(withVersion("AI SDK", project.versions.ai));
  }
  if (project.ai?.provider?.split(", ").includes("OpenRouter")) {
    lines.push(
      withVersion(
        "OpenRouter provider",
        project.versions["@openrouter/ai-sdk-provider"],
      ),
    );
  } else if (project.ai?.provider) {
    lines.push(project.ai.provider);
  }
  for (const name of project.database ?? []) {
    lines.push(name);
  }
  for (const name of project.orm ?? []) {
    lines.push(name);
  }
  return lines;
}

export function renderSetupReport(report: SetupReport): string {
  const lines = [`PromptMarket + ${report.agentName ?? "Cursor"}`, ""];
  if (report.mode === "check") {
    lines.push(...report.checks, "", "Project");
    if (report.projectLines.length === 0) {
      lines.push("No framework or AI packages detected.");
    } else {
      for (const line of report.projectLines) {
        lines.push(`✓ ${line}`);
      }
    }
    lines.push("", report.ready ? "Ready." : "Not ready.");
    if (report.ready && report.agentHint) {
      lines.push(
        "",
        "Cursor CLI can list the tools:",
        "agent mcp list-tools promptmarket",
      );
    }
    return `${lines.join("\n")}\n`;
  }

  for (const change of report.changes) {
    lines.push(`${change.file}`, `  ${change.action}`);
    for (const detail of change.lines) {
      lines.push(`  ${detail}`);
    }
    lines.push("");
  }
  if (report.mode === "dry-run") {
    lines.push("Dry run. Re-run with --write to apply.");
  } else if (report.mode === "remove") {
    lines.push("Removed PromptMarket from this project.");
  } else if (report.ready) {
    lines.push("Already installed.");
  } else {
    lines.push("Applied.");
  }
  return `${lines.join("\n")}\n`;
}
