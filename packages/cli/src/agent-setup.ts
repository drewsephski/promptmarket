import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { detectProject } from "@promptmarket/content";
import { AGENT_INSTRUCTIONS } from "./agent-instructions.js";
import {
  PROMPTMARKET_MCP_URL,
  projectCheckLines,
  type FileChange,
  type SetupMode,
  type SetupReport,
} from "./setup-common.js";

export const SETUP_AGENTS = {
  codex: {
    name: "Codex",
    file: ".codex/config.toml",
    key: "mcp_servers",
    instructions: "AGENTS.md",
  },
  opencode: {
    name: "OpenCode",
    file: "opencode.json",
    key: "mcp",
    instructions: "AGENTS.md",
  },
  "claude-code": {
    name: "Claude Code",
    file: ".mcp.json",
    key: "mcpServers",
    instructions: "CLAUDE.md",
  },
  "github-copilot": {
    name: "GitHub Copilot (VS Code)",
    file: ".vscode/mcp.json",
    key: "servers",
    instructions: ".github/copilot-instructions.md",
  },
} as const;

export type SetupAgent = keyof typeof SETUP_AGENTS;
type Config = Record<string, unknown>;
const START = "<!-- promptmarket:start -->";
const END = "<!-- promptmarket:end -->";
const INSTRUCTIONS = `${START}\n## PromptMarket\n\n${AGENT_INSTRUCTIONS}${END}`;

function isRecord(value: unknown): value is Config {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function readConfig(root: string, agent: SetupAgent) {
  const profile = SETUP_AGENTS[agent];
  let file: string = profile.file;
  let raw = await readText(path.join(root, file));
  if (agent === "opencode") {
    const jsonc = await readText(path.join(root, "opencode.jsonc"));
    if (jsonc !== undefined && raw !== undefined) {
      throw new Error(
        "Both opencode.json and opencode.jsonc exist. Consolidate them before setup.",
      );
    }
    if (jsonc !== undefined) {
      file = "opencode.jsonc";
      raw = jsonc;
    }
  }
  let config: unknown = {};
  try {
    if (raw !== undefined) {
      if (agent === "codex") config = parseToml(raw);
      else {
        const errors: ParseError[] = [];
        config = parse(raw, errors, { allowTrailingComma: true });
        if (errors.length > 0) throw new Error("Invalid JSON/JSONC");
      }
    }
    if (!isRecord(config)) throw new Error("Expected an object");
    if (profile.key in config && !isRecord(config[profile.key])) {
      throw new Error(`Expected ${profile.key} to be an object`);
    }
  } catch (error) {
    throw new Error(
      `Could not parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const servers = (config[profile.key] ?? {}) as Config;
  return { file, raw, config, servers };
}

function serverFor(agent: SetupAgent, existing: unknown): Config {
  const server: Config = isRecord(existing) ? { ...existing } : {};
  // A remote connection cannot retain the old stdio transport.
  for (const key of [
    "command",
    "args",
    "env",
    "env_vars",
    "environment",
    "cwd",
    "type",
    "disabled",
  ])
    delete server[key];
  server.url = PROMPTMARKET_MCP_URL;
  if (agent === "opencode") {
    server.type = "remote";
    server.enabled = true;
  }
  if (agent === "codex") server.enabled = true;
  if (agent === "claude-code" || agent === "github-copilot")
    server.type = "http";
  return server;
}

function installed(agent: SetupAgent, value: unknown): boolean {
  if (
    !isRecord(value) ||
    value.url !== PROMPTMARKET_MCP_URL ||
    value.enabled === false ||
    value.disabled === true ||
    "command" in value
  )
    return false;
  if (agent === "opencode") return value.type === "remote";
  if (agent === "codex") return !("type" in value);
  return value.type === "http";
}

function editInstructions(
  raw: string | undefined,
  remove: boolean,
): string | undefined {
  if (raw === undefined) return remove ? undefined : `${INSTRUCTIONS}\n`;
  const start = raw.indexOf(START);
  const end = raw.indexOf(END);
  if (
    start < 0 !== end < 0 ||
    end < start ||
    raw.indexOf(START, start + START.length) >= 0 ||
    raw.indexOf(END, end + END.length) >= 0
  ) {
    throw new Error(
      "Malformed PromptMarket instruction markers; repair the managed block before setup.",
    );
  }
  if (start < 0)
    return remove
      ? raw
      : `${raw}${raw.endsWith("\n") ? "\n" : "\n\n"}${INSTRUCTIONS}\n`;
  const next =
    raw.slice(0, start) +
    (remove ? "" : INSTRUCTIONS) +
    raw.slice(end + END.length);
  return remove && next.trim() === "" ? undefined : next;
}

type PlannedFile = {
  file: string;
  before: string | undefined;
  after: string | undefined;
};

export async function planAgentSetup(
  root: string,
  agent: SetupAgent,
  mode: SetupMode,
): Promise<{ report: SetupReport; files: PlannedFile[] }> {
  const profile = SETUP_AGENTS[agent];
  const current = await readConfig(root, agent);
  const present = "promptmarket" in current.servers;
  const ready = installed(agent, current.servers.promptmarket);
  let nextConfig = current.raw;
  if (mode === "remove" ? present : !ready) {
    const server =
      mode === "remove"
        ? undefined
        : serverFor(agent, current.servers.promptmarket);
    if (agent === "codex") {
      const servers = { ...current.servers };
      if (server) servers.promptmarket = server;
      else delete servers.promptmarket;
      // TOML serialization retains all settings, but normalizes formatting/comments.
      nextConfig = stringifyToml({ ...current.config, [profile.key]: servers });
    } else {
      const raw = current.raw ?? "{}\n";
      nextConfig = applyEdits(
        raw,
        modify(raw, [profile.key, "promptmarket"], server, {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      );
    }
  }
  const before = await readText(path.join(root, profile.instructions));
  let keepShared = false;
  if (mode === "remove" && (agent === "codex" || agent === "opencode")) {
    const other = await readConfig(
      root,
      agent === "codex" ? "opencode" : "codex",
    );
    keepShared = "promptmarket" in other.servers;
  }
  const after = keepShared
    ? before
    : editInstructions(before, mode === "remove");
  const instructionsReady = before?.includes(INSTRUCTIONS) ?? false;
  const files: PlannedFile[] = [
    { file: current.file, before: current.raw, after: nextConfig },
    { file: profile.instructions, before, after },
  ];
  const changes: FileChange[] = files.map((file) => ({
    file: file.file,
    action:
      file.before === file.after
        ? "unchanged"
        : file.after === undefined
          ? "remove"
          : file.before === undefined
            ? "create"
            : "update",
    lines:
      file.file === current.file
        ? [
            mode === "remove"
              ? "remove only the PromptMarket server"
              : `${profile.key}.promptmarket.url = ${PROMPTMARKET_MCP_URL}`,
            ...(agent === "codex" && current.raw !== nextConfig
              ? [
                  "TOML formatting and comments will be normalized; other settings are retained.",
                ]
              : []),
          ]
        : [
            keepShared
              ? "retain shared instructions for the other agent"
              : "manage only the PromptMarket instruction block",
          ],
  }));
  return {
    files,
    report: {
      agentName: profile.name,
      mode,
      changes: mode === "check" ? [] : changes,
      checks: [
        `${ready ? "✓" : "✗"} ${current.file} ${ready ? "contains" : "does not contain an enabled remote"} PromptMarket`,
        `${instructionsReady ? "✓" : "✗"} ${profile.instructions} ${instructionsReady ? "installed" : "is missing or outdated"}`,
        "Checks project files only; reload your agent and verify its MCP connection.",
        ...(agent === "codex"
          ? ["Codex loads project configuration only for trusted projects."]
          : []),
      ],
      projectLines: projectCheckLines(detectProject(root)),
      ready: ready && instructionsReady,
      agentHint: false,
    },
  };
}

export async function applyAgentSetup(
  root: string,
  files: PlannedFile[],
): Promise<void> {
  // Detect edits made since planning before changing either file.
  for (const file of files) {
    if ((await readText(path.join(root, file.file))) !== file.before) {
      throw new Error(
        `${file.file} changed during setup. Re-run to use its latest contents.`,
      );
    }
  }
  for (const file of files) {
    if (file.before === file.after) continue;
    const target = path.join(root, file.file);
    if (file.after === undefined) {
      await rm(target, { force: true });
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, file.after, "utf8");
      await rename(temp, target);
    } finally {
      await rm(temp, { force: true });
    }
  }
}
