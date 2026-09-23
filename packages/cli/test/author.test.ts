import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { run, type CliIo } from "../src/program.js";
import type { ProcessRunner } from "@promptmarket/registry";

const recipesDir = path.resolve(import.meta.dirname, "../../../recipes");

function captureIo(): CliIo & { out: () => string; err: () => string } {
  let stdout = "";
  let stderr = "";
  return {
    stdout: function writeStdout(message: string) {
      stdout += message;
    },
    stderr: function writeStderr(message: string) {
      stderr += message;
    },
    out: function readStdout() {
      return stdout;
    },
    err: function readStderr() {
      return stderr;
    },
  };
}

describe("authoring cli", function authoringCli() {
  const tempDirs: string[] = [];

  afterEach(async function cleanup() {
    await Promise.all(
      tempDirs.splice(0).map(function remove(directory) {
        return rm(directory, { recursive: true, force: true });
      }),
    );
  });

  test("init --json writes a valid authoring directory", async function inits() {
    const parent = await mkdtemp(path.join(os.tmpdir(), "promptmarket-init-"));
    tempDirs.push(parent);
    const directory = path.join(parent, "sample-agent");
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "init",
        directory,
        "--description",
        "Review a local diff.",
        "--author",
        "Ada Lovelace",
        "--compatibility",
        "cursor,codex",
        "--json",
      ],
      io,
    );
    const payload = JSON.parse(io.out()) as {
      ok: boolean;
      name: string;
      files: string[];
    };
    const skill = await readFile(path.join(directory, "SKILL.md"), "utf8");

    expect(exitCode).toBe(0);
    expect(payload).toMatchObject({
      ok: true,
      name: "sample-agent",
      version: "0.1.0",
      files: ["promptmarket.yaml", "SKILL.md"],
    });
    expect(skill).toContain("name: sample-agent");
    expect(skill).toContain("## When to use");
  });

  test("init --json reports missing options without prompting", async function missingOptions() {
    const io = captureIo();
    const exitCode = await run(
      ["node", "promptmarket", "init", "sample-agent", "--json"],
      io,
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(io.out())).toEqual({
      ok: false,
      error:
        "Missing required options: --author, --compatibility, --description",
    });
  });

  test("prompts when interactive input is injected", async function prompts() {
    const parent = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-prompt-"),
    );
    tempDirs.push(parent);
    const answers = [
      "",
      "",
      "Review a local diff.",
      "Ada Lovelace",
      "",
      "review",
      "cursor",
      "read",
      "n",
      "github.com",
      "",
    ];
    const io = captureIo();
    const exitCode = await run(
      ["node", "promptmarket", "init", path.join(parent, "sample-agent")],
      io,
      {
        interactive: true,
        prompt: async function answer() {
          return answers.shift() ?? "";
        },
      },
    );
    expect(exitCode).toBe(0);
    expect(io.out()).toContain("created sample-agent");
  });

  test("check --json reports author issues", async function checksIssues() {
    const parent = await mkdtemp(path.join(os.tmpdir(), "promptmarket-check-"));
    tempDirs.push(parent);
    const directory = path.join(parent, "sample-agent");
    await mkdir(directory, { recursive: true });
    await writeEmpty(directory);
    const io = captureIo();
    const exitCode = await run(
      ["node", "promptmarket", "check", directory, "--json"],
      io,
    );
    const payload = JSON.parse(io.out()) as {
      ok: boolean;
      issues: Array<{ code: string }>;
    };
    expect(exitCode).toBe(1);
    expect(payload.ok).toBe(false);
    expect(
      payload.issues.map(function codeOf(issue) {
        return issue.code;
      }),
    ).toEqual(expect.arrayContaining(["manifest_missing", "skill_missing"]));
  });

  test("check and pack accept an initialized recipe", async function checksAndPacks() {
    const parent = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-pack-cli-"),
    );
    tempDirs.push(parent);
    const directory = path.join(parent, "sample-agent");
    const init = captureIo();
    expect(
      await run(
        [
          "node",
          "promptmarket",
          "init",
          directory,
          "--description",
          "Review a local diff.",
          "--author",
          "Ada Lovelace",
          "--compatibility",
          "cursor",
          "--json",
        ],
        init,
      ),
    ).toBe(0);

    const check = captureIo();
    const checkExit = await run(
      ["node", "promptmarket", "check", directory, "--json"],
      check,
    );
    const checked = JSON.parse(check.out()) as {
      ok: boolean;
      integrity: string;
    };
    expect(checkExit).toBe(0);
    expect(checked.ok).toBe(true);
    expect(checked.integrity).toMatch(/^sha256-/);

    const pack = captureIo();
    const packExit = await run(
      [
        "node",
        "promptmarket",
        "pack",
        directory,
        "--out",
        path.join(parent, "dist"),
        "--json",
      ],
      pack,
    );
    const packed = JSON.parse(pack.out()) as {
      ok: boolean;
      integrity: string;
      artifactPath: string;
    };
    expect(packExit).toBe(0);
    expect(packed.integrity).toBe(checked.integrity);
    expect(packed.artifactPath).toContain("sample-agent-0.1.0.tgz");
  });

  test("submit --dry-run --json does not mutate and reports an existing version", async function dryRuns() {
    const parent = await mkdtemp(path.join(os.tmpdir(), "promptmarket-dry-"));
    tempDirs.push(parent);
    const directory = path.join(parent, "fresh-agent");
    const empty = path.join(parent, "empty-registry");
    await mkdir(empty, { recursive: true });
    expect(
      await run(
        [
          "node",
          "promptmarket",
          "init",
          directory,
          "--description",
          "Review a local diff.",
          "--author",
          "Ada Lovelace",
          "--compatibility",
          "cursor",
          "--json",
        ],
        captureIo(),
      ),
    ).toBe(0);
    const before = await readFile(path.join(directory, "SKILL.md"), "utf8");
    let called = false;
    const runner: ProcessRunner = {
      async run() {
        called = true;
        throw new Error("dry run invoked a subprocess");
      },
    };
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "submit",
        directory,
        "--dry-run",
        "--json",
        "--recipes",
        empty,
      ],
      io,
      { runner },
    );
    const payload = JSON.parse(io.out()) as {
      ok: boolean;
      dryRun: boolean;
      plan: { branch: string; destination: string };
    };

    expect(exitCode).toBe(0);
    expect(called).toBe(false);
    expect(payload.dryRun).toBe(true);
    expect(payload.plan.branch).toBe("recipe/fresh-agent-0.1.0");
    expect(payload.plan.destination).toBe("recipes/fresh-agent/0.1.0");
    expect(await readFile(path.join(directory, "SKILL.md"), "utf8")).toBe(
      before,
    );

    const historical = path.join(parent, "github-pr-review");
    expect(
      await run(
        [
          "node",
          "promptmarket",
          "init",
          historical,
          "--recipe-version",
          "0.1.0",
          "--description",
          "Review a local diff.",
          "--author",
          "Ada Lovelace",
          "--compatibility",
          "cursor",
          "--json",
        ],
        captureIo(),
      ),
    ).toBe(0);
    const exists = captureIo();
    const existsExit = await run(
      [
        "node",
        "promptmarket",
        "submit",
        historical,
        "--dry-run",
        "--json",
        "--recipes",
        recipesDir,
      ],
      exists,
    );
    expect(existsExit).toBe(1);
    expect(JSON.parse(exists.out())).toMatchObject({
      ok: false,
      error: "Recipe version already exists: github-pr-review@0.1.0",
    });
  });

  test("submit reports when gh is missing", async function missingGh() {
    const parent = await mkdtemp(path.join(os.tmpdir(), "promptmarket-gh-"));
    tempDirs.push(parent);
    const directory = path.join(parent, "fresh-agent");
    const empty = path.join(parent, "empty-registry");
    await mkdir(empty, { recursive: true });
    expect(
      await run(
        [
          "node",
          "promptmarket",
          "init",
          directory,
          "--description",
          "Review a local diff.",
          "--author",
          "Ada Lovelace",
          "--compatibility",
          "cursor",
          "--json",
        ],
        captureIo(),
      ),
    ).toBe(0);
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "submit",
        directory,
        "--json",
        "--recipes",
        empty,
      ],
      io,
      {
        runner: {
          async run() {
            return {
              code: 127,
              stdout: "",
              stderr: "gh was not found",
              stdoutBuffer: new Uint8Array(),
            };
          },
        },
      },
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(io.out())).toMatchObject({
      ok: false,
      error: expect.stringContaining("https://cli.github.com"),
    });
  });
});

async function writeEmpty(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
}
