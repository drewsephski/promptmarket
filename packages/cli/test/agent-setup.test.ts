import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { parse as parseToml } from "smol-toml";
import { afterEach, expect, test } from "vitest";
import { run } from "../src/program.js";
import { applyAgentSetup, planAgentSetup } from "../src/agent-setup.js";

const dirs: string[] = [];
async function project() {
  const root = await mkdtemp(path.join(os.tmpdir(), "promptmarket-agents-"));
  dirs.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function setup(root: string, agent: string, ...options: string[]) {
  let out = "";
  let err = "";
  const code = await run(
    ["node", "promptmarket", "setup", agent, "--dir", root, ...options],
    {
      stdout: (text) => {
        out += text;
      },
      stderr: (text) => {
        err += text;
      },
    },
  );
  return { code, out, err };
}

const clients = [
  {
    agent: "codex",
    file: ".codex/config.toml",
    instructions: "AGENTS.md",
    key: "mcp_servers",
    type: undefined,
  },
  {
    agent: "opencode",
    file: "opencode.json",
    instructions: "AGENTS.md",
    key: "mcp",
    type: "remote",
  },
  {
    agent: "claude-code",
    file: ".mcp.json",
    instructions: "CLAUDE.md",
    key: "mcpServers",
    type: "http",
  },
  {
    agent: "github-copilot",
    file: ".vscode/mcp.json",
    instructions: ".github/copilot-instructions.md",
    key: "servers",
    type: "http",
  },
] as const;

test.each(clients)(
  "$agent previews, merges, checks, and removes without losing unrelated data",
  async ({ agent, file, instructions, key, type }) => {
    const root = await project();
    const configPath = path.join(root, file);
    const instructionPath = path.join(root, instructions);
    await mkdir(path.dirname(configPath), { recursive: true });
    await mkdir(path.dirname(instructionPath), { recursive: true });
    const original =
      agent === "codex"
        ? 'model = "my-model"\n[mcp_servers.other]\ncommand = "my-tool"\n'
        : JSON.stringify({
            [key]: { other: { command: "my-tool" } },
            custom: { keep: true },
          });
    await writeFile(configPath, original);
    await writeFile(instructionPath, "# Team instructions\nKeep this text.\n");
    const preview = await setup(root, agent);
    expect(preview.code).toBe(0);
    expect(preview.out).toContain("Dry run");
    expect(await readFile(configPath, "utf8")).toBe(original);
    expect((await setup(root, agent, "--check")).code).toBe(1);

    const result = await setup(root, agent, "--write");
    expect(result.err).toBe("");
    expect(result.code).toBe(0);
    const raw = await readFile(configPath, "utf8");
    const config = agent === "codex" ? parseToml(raw) : parseJsonc(raw);
    expect(config[key].promptmarket.url).toBe("https://promptmarket.sh/mcp");
    expect(config[key].promptmarket.type).toBe(type);
    expect(config[key].other.command).toBe("my-tool");
    if (agent === "codex") expect(config.model).toBe("my-model");
    else expect(config.custom).toEqual({ keep: true });
    expect(await readFile(instructionPath, "utf8")).toContain(
      "# Team instructions\nKeep this text.",
    );
    expect(await readFile(instructionPath, "utf8")).toContain("get_workflow");
    expect((await setup(root, agent, "--check")).code).toBe(0);
    expect((await setup(root, agent, "--write")).out).toContain(
      "Already installed",
    );
    expect(await readFile(configPath, "utf8")).toBe(raw);

    expect((await setup(root, agent, "--remove")).code).toBe(0);
    const removedRaw = await readFile(configPath, "utf8");
    const removed =
      agent === "codex" ? parseToml(removedRaw) : parseJsonc(removedRaw);
    expect(removed[key].promptmarket).toBeUndefined();
    expect(removed[key].other.command).toBe("my-tool");
    expect(await readFile(instructionPath, "utf8")).toContain(
      "Keep this text.",
    );
    expect(await readFile(instructionPath, "utf8")).not.toContain(
      "promptmarket:start",
    );
  },
);

test.each(clients)(
  "$agent rejects broken config and conflicting flags without writes",
  async ({ agent, file, instructions }) => {
    const root = await project();
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), "{");
    const result = await setup(root, agent, "--write");
    expect(result.code).toBe(1);
    expect(result.err).toContain("Could not parse");
    expect(await readFile(path.join(root, file), "utf8")).toBe("{");
    await expect(readFile(path.join(root, instructions))).rejects.toThrow();
    const conflict = await setup(root, agent, "--write", "--remove");
    expect(conflict.code).toBe(1);
    expect(conflict.err).toContain("Use only one");
  },
);

test.each(clients)(
  "$agent installs in an empty project and removes generated instructions",
  async ({ agent, instructions }) => {
    const root = await project();
    expect((await setup(root, agent, "--remove")).code).toBe(0);
    expect((await setup(root, agent, "--write")).code).toBe(0);
    expect((await setup(root, agent, "--check")).code).toBe(0);
    expect((await setup(root, agent, "--remove")).code).toBe(0);
    await expect(readFile(path.join(root, instructions))).rejects.toThrow();
  },
);

test("OpenCode updates existing JSONC, preserving comments and settings, and migrates local transport", async () => {
  const root = await project();
  await writeFile(
    path.join(root, "opencode.jsonc"),
    `{
  // Keep this team comment.
  "instructions": ["CONTRIBUTING.md"],
  "mcp": { "promptmarket": { "type": "local", "command": ["node", "old.js"], "enabled": false }, },
}`,
  );
  expect((await setup(root, "opencode", "--write")).code).toBe(0);
  const raw = await readFile(path.join(root, "opencode.jsonc"), "utf8");
  expect(raw).toContain("// Keep this team comment.");
  expect(parseJsonc(raw).instructions).toEqual(["CONTRIBUTING.md"]);
  expect(parseJsonc(raw).mcp.promptmarket).toEqual({
    type: "remote",
    url: "https://promptmarket.sh/mcp",
    enabled: true,
  });
  await expect(readFile(path.join(root, "opencode.json"))).rejects.toThrow();
  await writeFile(path.join(root, "opencode.json"), "{}");
  expect((await setup(root, "opencode", "--write")).err).toContain(
    "Both opencode.json and opencode.jsonc",
  );
});

test("Codex preserves nested settings when repairing a disabled stdio server", async () => {
  const root = await project();
  await mkdir(path.join(root, ".codex"));
  await writeFile(
    path.join(root, ".codex/config.toml"),
    '[mcp_servers.promptmarket]\ncommand = "node"\nargs = ["old.js"]\nenabled = false\ntool_timeout_sec = 45\n[mcp_servers.promptmarket.tools.search]\napproval_mode = "prompt"\n',
  );
  expect((await setup(root, "codex", "--check")).code).toBe(1);
  expect((await setup(root, "codex", "--write")).code).toBe(0);
  const raw = await readFile(path.join(root, ".codex/config.toml"), "utf8");
  expect(raw).not.toContain("command =");
  expect(raw).not.toContain("args =");
  expect(raw).toContain('approval_mode = "prompt"');
  expect(raw).toContain("tool_timeout_sec = 45");
  expect((await setup(root, "codex", "--check")).code).toBe(0);
});

test("shared instructions survive removing one of Codex and OpenCode", async () => {
  const root = await project();
  await setup(root, "codex", "--write");
  const original = await readFile(path.join(root, "AGENTS.md"), "utf8");
  await setup(root, "opencode", "--write");
  expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toBe(original);
  await setup(root, "codex", "--remove");
  expect((await setup(root, "opencode", "--check")).code).toBe(0);
  await setup(root, "opencode", "--remove");
  await expect(readFile(path.join(root, "AGENTS.md"))).rejects.toThrow();
});

test("malformed instruction markers abort before writing MCP config", async () => {
  const root = await project();
  await writeFile(
    path.join(root, "AGENTS.md"),
    "# Keep\n<!-- promptmarket:start -->\nUnfinished",
  );
  const result = await setup(root, "codex", "--write");
  expect(result.code).toBe(1);
  expect(result.err).toContain("Malformed PromptMarket");
  await expect(
    readFile(path.join(root, ".codex/config.toml")),
  ).rejects.toThrow();
});

test("changes made after planning are not overwritten", async () => {
  const root = await project();
  const plan = await planAgentSetup(root, "opencode", "write");
  await writeFile(path.join(root, "AGENTS.md"), "Concurrent edit");
  await expect(applyAgentSetup(root, plan.files)).rejects.toThrow(
    "changed during setup",
  );
  expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toBe(
    "Concurrent edit",
  );
  await expect(readFile(path.join(root, "opencode.json"))).rejects.toThrow();
});
