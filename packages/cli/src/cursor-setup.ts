import {
  PROMPTMARKET_MCP_URL,
  projectCheckLines,
  type FileChange,
  type SetupMode,
  type SetupReport,
} from "./setup-common.js";
import { AGENT_INSTRUCTIONS } from "./agent-instructions.js";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectProject } from "@promptmarket/content";

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

${AGENT_INSTRUCTIONS}`;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function promptmarketServer(url = PROMPTMARKET_MCP_URL): JsonRecord {
  return { url };
}

function sameServer(value: unknown): boolean {
  if (
    !isRecord(value) ||
    value.url !== PROMPTMARKET_MCP_URL ||
    "command" in value ||
    value.disabled === true
  ) {
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
    const remote = { ...current, url: PROMPTMARKET_MCP_URL };
    for (const key of ["command", "args", "env", "cwd", "type", "disabled"])
      delete (remote as JsonRecord)[key];
    servers.promptmarket = remote;
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
    isRecord(current) && typeof current.url === "string"
      ? current.url
      : undefined;
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
    return {
      file: RULE_FILE,
      action: "create",
      lines: ["create promptmarket.mdc"],
    };
  }
  if (before === CURSOR_RULE) {
    return {
      file: RULE_FILE,
      action: "unchanged",
      lines: ["promptmarket.mdc"],
    };
  }
  return {
    file: RULE_FILE,
    action: "update",
    lines: ["replace promptmarket.mdc"],
  };
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
        action:
          inspected.mcpRaw === undefined
            ? "missing"
            : hadServer
              ? "remove"
              : "unchanged",
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
  if (
    inspected.mcpRaw !== undefined &&
    sameServer(
      isRecord(inspected.mcpConfig.mcpServers)
        ? inspected.mcpConfig.mcpServers.promptmarket
        : undefined,
    )
  ) {
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
    if (
      inspected.mcpRaw !== undefined &&
      inspected.mcpRaw !== inspected.nextMcp
    ) {
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
