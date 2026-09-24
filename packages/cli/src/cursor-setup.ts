import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectProject, type ProjectContext } from "@promptmarket/content";

export const PROMPTMARKET_MCP_URL = "https://promptmarket.sh/mcp";
export const CONTEXT7_SETUP_COMMAND = [
  "npx",
  "--yes",
  "ctx7",
  "setup",
  "--cursor",
  "--project",
] as const;
export const MCP_FILE = ".cursor/mcp.json";
export const RULE_FILE = ".cursor/rules/promptmarket.mdc";

export const CURSOR_RULE = `---
description: Use PromptMarket when implementing or debugging AI application features
alwaysApply: false
---

Before modifying AI-related code:

1. Read \`.promptmarket/features/*.yaml\`.
2. Compare the files you expect to edit with \`implementation.paths\`.
3. If an existing feature owns those paths, treat its contract as the baseline, call \`get_workflow\` with that feature, and preserve its verification requirements.
4. If no contract matches and the work creates a new AI capability, call \`get_workflow\`, then suggest \`promptmarket feature init\` with \`--path\` after implementation.
5. \`get_workflow\` returns the same decision as \`build_context\` and \`build_plan\`, plus \`documentationTargets\`, \`debugTargets\`, \`evalTargets\`, and \`observabilityTargets\`. It does not read the repository, and it does not call Context7, Promptfoo, or Langfuse.
6. Read \`documentationTargets\`. For each target, query Context7 for that library, the target reason, and the detected version. Treat Context7 as the source of truth for current library syntax.
7. Treat PromptMarket as the source of truth for architecture, the AI engineering pattern, implementation sequence, prompting strategy, and which checks matter.
8. If current documentation conflicts with a PromptMarket guide, follow the current documentation, adapt the guide, and mention the discrepancy.
9. Implement using the existing repository's conventions. Do not paste instrumentation from memory.
10. When behavior is wrong, read \`debugTargets\` and follow the diagnosis order. For \`ai-sdk-devtools\`, follow current AI SDK docs to register DevTools for the installed version, then run \`npx @ai-sdk/devtools@latest\`. DevTools stores prompts and tool data locally in plain text. Use it only in local development.
11. Before considering the work complete, keep the feature contract in \`.promptmarket/features/\`. Own the files you touched with \`implementation.paths\`. Run \`promptmarket verify changed --base origin/main\` so only the impacted Promptfoo suite runs. Promptfoo owns the evaluator.
12. Before merge, run \`promptmarket verify ci --github\` so the Promptfoo GitHub Action gates the pull request. The workflow computes impact inside the job and runs only the affected suites. Promptfoo posts the result and fails the job when the suite fails. \`promptmarket feature check --all\` fails only on objective contract problems.
13. When production tracing is in scope, read \`observabilityTargets\`. For Langfuse, query current Langfuse and AI SDK docs, inspect any existing OpenTelemetry setup, and integrate without replacing an existing tracer. \`promptmarket observe setup langfuse\` prints packages, environment names, and metadata. It does not edit application code. Curated Langfuse dataset items become regression cases with \`promptmarket verify sync langfuse\`.
14. Never assume external services or environment configuration exist merely because the guide requires them.

A PromptMarket plan is curated knowledge from when the guide was written. It becomes a verified plan only after those documentation targets are reconciled with live library docs. Do not describe the plan as live-verified before that step.
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

export function context7Configured(config: JsonRecord): boolean {
  const servers = isRecord(config.mcpServers) ? config.mcpServers : {};
  for (const [name, value] of Object.entries(servers)) {
    if (name === "context7") {
      return true;
    }
    if (
      isRecord(value) &&
      typeof value.url === "string" &&
      value.url.includes("mcp.context7.com")
    ) {
      return true;
    }
  }
  return false;
}

export function handoffContext7(root: string): Promise<number> {
  const [command, ...args] = CONTEXT7_SETUP_COMMAND;
  return new Promise(function run(resolve, reject) {
    const child = spawn(command, args, {
      cwd: path.resolve(root),
      stdio: "inherit",
    });
    child.on("error", function failed(error) {
      reject(error);
    });
    child.on("exit", function exited(code) {
      resolve(code ?? 1);
    });
  });
}
