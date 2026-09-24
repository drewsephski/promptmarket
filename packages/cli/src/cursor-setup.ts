import { spawnSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectProject, type ProjectContext } from "@promptmarket/content";

export const PROMPTMARKET_MCP_URL = "https://promptmarket.sh/mcp";
export const MCP_FILE = ".cursor/mcp.json";
export const RULE_FILE = ".cursor/rules/promptmarket.mdc";

export const CURSOR_RULE = `---
description: Use PromptMarket when implementing or debugging AI application features
alwaysApply: false
---

When the task involves AI application architecture, prompting, RAG,
structured outputs, tool calling, agents, evals, or related features:

1. Call the PromptMarket \`build_context\` MCP tool before implementation.
2. Include the current project's framework, package names, and versions when known.
3. Treat the user's requested goal as more important than the existing stack.
4. Use the primary guide/prompt/lesson as reference context.
5. Call \`get_guide\`, \`get_prompt\`, or \`get_learn_topic\` only when more detail is needed.
6. Inspect the actual repository before modifying code.
7. Prefer existing project conventions over blindly copying tutorial code.
8. Do not claim packages, services, environment variables, or database features exist unless verified.
`;

export type SetupMode = "dry-run" | "write" | "remove" | "check";

type JsonRecord = Record<string, unknown>;

export type FileChange = {
  file: string;
  action: "create" | "update" | "remove" | "unchanged" | "missing";
  lines: string[];
};

export type SetupReport = {
  mode: SetupMode;
  changes: FileChange[];
  checks: string[];
  projectLines: string[];
  ready: boolean;
  agentHint: boolean;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function promptmarketServer(url = PROMPTMARKET_MCP_URL): JsonRecord {
  return { url };
}

function sameServer(value: unknown): boolean {
  if (!isRecord(value) || value.url !== PROMPTMARKET_MCP_URL) {
    return false;
  }
  return true;
}

async function readText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
}

function parseMcp(raw: string, file: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`Could not parse ${file}: ${message}`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`Could not parse ${file}: expected a JSON object`);
  }
  if ("mcpServers" in parsed && !isRecord(parsed.mcpServers)) {
    throw new Error(`Expected mcpServers in ${file} to be an object`);
  }
  return parsed;
}

function withPromptmarket(config: JsonRecord): JsonRecord {
  const servers = isRecord(config.mcpServers) ? { ...config.mcpServers } : {};
  const current = servers.promptmarket;
  if (isRecord(current)) {
    servers.promptmarket = { ...current, url: PROMPTMARKET_MCP_URL };
  } else {
    servers.promptmarket = promptmarketServer();
  }
  return { ...config, mcpServers: servers };
}

function withoutPromptmarket(config: JsonRecord): JsonRecord {
  if (!isRecord(config.mcpServers) || !("promptmarket" in config.mcpServers)) {
    return config;
  }
  const servers = { ...config.mcpServers };
  delete servers.promptmarket;
  return { ...config, mcpServers: servers };
}

function serialize(config: JsonRecord): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

async function writeAtomic(file: string, contents: string): Promise<void> {
  const directory = path.dirname(file);
  await mkdir(directory, { recursive: true });
  const temp = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.tmp`,
  );
  await writeFile(temp, contents, "utf8");
  await rename(temp, file);
}

function mcpChange(before: string | undefined, after: string): FileChange {
  if (before === undefined) {
    return {
      file: MCP_FILE,
      action: "create",
      lines: [`mcpServers.promptmarket.url = ${PROMPTMARKET_MCP_URL}`],
    };
  }
  if (before === after) {
    return {
      file: MCP_FILE,
      action: "unchanged",
      lines: [`mcpServers.promptmarket.url = ${PROMPTMARKET_MCP_URL}`],
    };
  }
  const previous = parseMcp(before, MCP_FILE);
  const servers = isRecord(previous.mcpServers) ? previous.mcpServers : {};
  const current = servers.promptmarket;
  const previousUrl =
    isRecord(current) && typeof current.url === "string" ? current.url : undefined;
  if (previousUrl && previousUrl !== PROMPTMARKET_MCP_URL) {
    return {
      file: MCP_FILE,
      action: "update",
      lines: [
        `mcpServers.promptmarket.url: ${previousUrl} → ${PROMPTMARKET_MCP_URL}`,
      ],
    };
  }
  if (!("promptmarket" in servers)) {
    return {
      file: MCP_FILE,
      action: "update",
      lines: [`add mcpServers.promptmarket.url = ${PROMPTMARKET_MCP_URL}`],
    };
  }
  return {
    file: MCP_FILE,
    action: "update",
    lines: [`mcpServers.promptmarket.url = ${PROMPTMARKET_MCP_URL}`],
  };
}

function ruleChange(before: string | undefined): FileChange {
  if (before === undefined) {
    return { file: RULE_FILE, action: "create", lines: ["create promptmarket.mdc"] };
  }
  if (before === CURSOR_RULE) {
    return { file: RULE_FILE, action: "unchanged", lines: ["promptmarket.mdc"] };
  }
  return { file: RULE_FILE, action: "update", lines: ["replace promptmarket.mdc"] };
}

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

export function cursorAgentInstalled(): boolean {
  const command = process.platform === "win32" ? "where" : "which";
  const probe = spawnSync(command, ["agent"], { encoding: "utf8" });
  return probe.status === 0;
}

export async function inspectCursorSetup(
  root: string,
  mode: SetupMode,
): Promise<{
  mcpRaw: string | undefined;
  ruleRaw: string | undefined;
  nextMcp: string;
  mcpConfig: JsonRecord;
}> {
  const directory = path.resolve(root);
  const mcpPath = path.join(directory, MCP_FILE);
  const rulePath = path.join(directory, RULE_FILE);
  const mcpRaw = await readText(mcpPath);
  const ruleRaw = await readText(rulePath);
  const config = mcpRaw === undefined ? {} : parseMcp(mcpRaw, MCP_FILE);
  const next =
    mode === "remove" ? withoutPromptmarket(config) : withPromptmarket(config);
  return {
    mcpRaw,
    ruleRaw,
    nextMcp: serialize(next),
    mcpConfig: config,
  };
}

export async function planCursorSetup(
  root: string,
  mode: SetupMode,
  agentHint: boolean,
): Promise<SetupReport> {
  const inspected = await inspectCursorSetup(root, mode);
  const projectLines = projectCheckLines(detectProject(root));

  if (mode === "check") {
    const servers = isRecord(inspected.mcpConfig.mcpServers)
      ? inspected.mcpConfig.mcpServers
      : {};
    const installed = sameServer(servers.promptmarket);
    const ruleInstalled = inspected.ruleRaw === CURSOR_RULE;
    const checks = [
      installed
        ? "✓ .cursor/mcp.json contains PromptMarket"
        : "✗ .cursor/mcp.json does not contain PromptMarket",
      installed
        ? `✓ MCP URL: ${PROMPTMARKET_MCP_URL}`
        : `✗ MCP URL: expected ${PROMPTMARKET_MCP_URL}`,
      ruleInstalled
        ? "✓ .cursor/rules/promptmarket.mdc installed"
        : "✗ .cursor/rules/promptmarket.mdc is missing",
    ];
    return {
      mode,
      changes: [],
      checks,
      projectLines,
      ready: installed && ruleInstalled,
      agentHint,
    };
  }

  if (mode === "remove") {
    const hadServer =
      isRecord(inspected.mcpConfig.mcpServers) &&
      "promptmarket" in inspected.mcpConfig.mcpServers;
    const changes: FileChange[] = [
      {
        file: MCP_FILE,
        action: inspected.mcpRaw === undefined ? "missing" : hadServer ? "remove" : "unchanged",
        lines: hadServer
          ? ["remove mcpServers.promptmarket"]
          : ["mcpServers.promptmarket was not present"],
      },
      {
        file: RULE_FILE,
        action: inspected.ruleRaw === undefined ? "missing" : "remove",
        lines:
          inspected.ruleRaw === undefined
            ? ["promptmarket.mdc was not present"]
            : ["remove promptmarket.mdc"],
      },
    ];
    return {
      mode,
      changes,
      checks: [],
      projectLines,
      ready: true,
      agentHint: false,
    };
  }

  const mcp = mcpChange(inspected.mcpRaw, inspected.nextMcp);
  const rule = ruleChange(inspected.ruleRaw);
  if (inspected.mcpRaw !== undefined && sameServer(
    isRecord(inspected.mcpConfig.mcpServers)
      ? inspected.mcpConfig.mcpServers.promptmarket
      : undefined,
  )) {
    mcp.action = "unchanged";
    mcp.lines = [`mcpServers.promptmarket.url = ${PROMPTMARKET_MCP_URL}`];
  }
  return {
    mode,
    changes: [mcp, rule],
    checks: [],
    projectLines,
    ready: mcp.action === "unchanged" && rule.action === "unchanged",
    agentHint: false,
  };
}

export function renderSetupReport(report: SetupReport): string {
  const lines = ["PromptMarket + Cursor", ""];
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
      lines.push("", "Cursor CLI can list the tools:", "agent mcp list-tools promptmarket");
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

export async function applyCursorSetup(
  root: string,
  mode: SetupMode,
): Promise<void> {
  if (mode === "dry-run" || mode === "check") {
    return;
  }
  const directory = path.resolve(root);
  const inspected = await inspectCursorSetup(directory, mode);
  const mcpPath = path.join(directory, MCP_FILE);
  const rulePath = path.join(directory, RULE_FILE);
  if (mode === "remove") {
    if (inspected.mcpRaw !== undefined && inspected.mcpRaw !== inspected.nextMcp) {
      await writeAtomic(mcpPath, inspected.nextMcp);
    }
    if (inspected.ruleRaw !== undefined) {
      await rm(rulePath, { force: true });
    }
    return;
  }
  const servers = isRecord(inspected.mcpConfig.mcpServers)
    ? inspected.mcpConfig.mcpServers
    : {};
  if (!sameServer(servers.promptmarket) || inspected.mcpRaw === undefined) {
    await writeAtomic(mcpPath, inspected.nextMcp);
  }
  if (inspected.ruleRaw !== CURSOR_RULE) {
    await writeAtomic(rulePath, CURSOR_RULE);
  }
}
