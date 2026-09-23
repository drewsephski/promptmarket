import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  RecipeNotFoundError,
  RecipeVersionNotFoundError,
} from "../src/errors.js";
import {
  submitRecipe,
  writeRecipeDraft,
  type ProcessRunner,
  type Recipe,
  type RecipeDraft,
  type Registry,
} from "../src/index.js";

function draft(): RecipeDraft {
  return {
    name: "sample-agent",
    version: "0.1.0",
    description: "Review a local diff.",
    author: { name: "Ada Lovelace" },
    compatibility: ["cursor", "codex"],
    tags: ["review"],
    requires: { mcp: [] },
    capabilities: { filesystem: "read", shell: false, network: ["github.com"] },
    instructions: "# Sample Agent\n\n## Workflow\n\n1. Read the diff.\n",
  };
}

function registryWith(names: string[]): Registry {
  return {
    source: {
      type: "registry",
      url: "https://promptmarket.sh/api/registry/v1",
    },
    async list() {
      return [];
    },
    async search() {
      return [];
    },
    async listVersions(name) {
      throw new RecipeNotFoundError(name);
    },
    async fetchPackage(name) {
      throw new RecipeNotFoundError(name);
    },
    async get(name, version) {
      if (!names.includes(name)) {
        throw new RecipeNotFoundError(name);
      }
      if (!names.includes(`${name}@${version ?? ""}`)) {
        throw new RecipeVersionNotFoundError(name, version ?? "");
      }
      return {} as Recipe;
    },
  };
}

function scriptedRunner(
  calls: Array<{ command: string; args: readonly string[]; cwd?: string }>,
): ProcessRunner {
  return {
    async run(command, args, options) {
      calls.push({ command, args, cwd: options?.cwd });
      if (command === "gh" && args[0] === "api") {
        return {
          code: 0,
          stdout: "octocat\n",
          stderr: "",
          stdoutBuffer: new TextEncoder().encode("octocat\n"),
        };
      }
      if (command === "gh" && args[0] === "pr") {
        return {
          code: 0,
          stdout: "https://github.com/drewsephski/promptmarket/pull/7\n",
          stderr: "",
          stdoutBuffer: new TextEncoder().encode(
            "https://github.com/drewsephski/promptmarket/pull/7\n",
          ),
        };
      }
      return {
        code: 0,
        stdout: "",
        stderr: "",
        stdoutBuffer: new Uint8Array(),
      };
    },
  };
}

describe("submitRecipe", function submitRecipeTests() {
  const tempDirs: string[] = [];

  afterEach(async function cleanup() {
    await Promise.all(
      tempDirs.splice(0).map(function remove(directory) {
        return rm(directory, { recursive: true, force: true });
      }),
    );
  });

  async function recipeDir(): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), "promptmarket-submit-"));
    tempDirs.push(root);
    const directory = path.join(root, "sample-agent");
    await writeRecipeDraft(directory, draft());
    return directory;
  }

  test("does not call gh on a dry run", async function dryRun() {
    const calls: Array<{ command: string }> = [];
    const result = await submitRecipe(await recipeDir(), {
      dryRun: true,
      registry: registryWith([]),
      runner: {
        async run() {
          calls.push({ command: "unexpected" });
          throw new Error("dry run invoked a subprocess");
        },
      },
    });

    expect(calls).toEqual([]);
    expect(result.dryRun).toBe(true);
    expect(result.plan.branch).toBe("recipe/sample-agent-0.1.0");
    expect(result.plan.destination).toBe("recipes/sample-agent/0.1.0");
    expect(result.prUrl).toBeUndefined();
  });

  test("refuses a version that is already published", async function exists() {
    await expect(
      submitRecipe(await recipeDir(), {
        dryRun: true,
        registry: registryWith(["sample-agent", "sample-agent@0.1.0"]),
      }),
    ).rejects.toThrow("Recipe version already exists: sample-agent@0.1.0");
  });

  test("reports a missing GitHub CLI", async function missingGh() {
    await expect(
      submitRecipe(await recipeDir(), {
        registry: registryWith([]),
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
      }),
    ).rejects.toThrow("https://cli.github.com");
  });

  test("reports an unauthenticated GitHub CLI", async function unauthenticated() {
    await expect(
      submitRecipe(await recipeDir(), {
        registry: registryWith([]),
        runner: {
          async run(_command, args) {
            return {
              code: args[0] === "--version" ? 0 : 1,
              stdout: "",
              stderr: "You are not logged in",
              stdoutBuffer: new Uint8Array(),
            };
          },
        },
      }),
    ).rejects.toThrow("gh auth login");
  });

  test("commits only the new version and returns the pull request", async function submits() {
    const calls: Array<{
      command: string;
      args: readonly string[];
      cwd?: string;
    }> = [];
    let body = "";
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-workspace-"),
    );
    tempDirs.push(workspace);
    const runner = scriptedRunner(calls);
    const result = await submitRecipe(await recipeDir(), {
      registry: registryWith([]),
      runner: {
        async run(command, args, options) {
          if (command === "gh" && args[0] === "pr") {
            const bodyFile = args[args.indexOf("--body-file") + 1];
            if (bodyFile) {
              body = await readFile(bodyFile, "utf8");
            }
          }
          return runner.run(command, args, options);
        },
      },
      workspaceDir: workspace,
    });
    const packaged = await readFile(
      path.join(workspace, "recipes", "sample-agent", "0.1.0", "SKILL.md"),
      "utf8",
    );

    expect(result.prUrl).toBe(
      "https://github.com/drewsephski/promptmarket/pull/7",
    );
    expect(packaged).toContain("name: sample-agent");
    expect(
      calls.map(function command(call) {
        return [call.command, ...call.args];
      }),
    ).toEqual([
      ["gh", "--version"],
      ["gh", "auth", "status"],
      ["gh", "api", "user", "--jq", ".login"],
      ["gh", "repo", "fork", "drewsephski/promptmarket", "--clone=false"],
      ["gh", "repo", "clone", "octocat/promptmarket", workspace],
      [
        "git",
        "remote",
        "add",
        "upstream",
        "https://github.com/drewsephski/promptmarket.git",
      ],
      ["git", "fetch", "upstream", "main"],
      ["git", "checkout", "-B", "recipe/sample-agent-0.1.0", "upstream/main"],
      ["git", "add", "--", "recipes/sample-agent/0.1.0"],
      ["git", "commit", "-m", "Add sample-agent@0.1.0"],
      ["git", "push", "-u", "origin", "recipe/sample-agent-0.1.0"],
      [
        "gh",
        "pr",
        "create",
        "--repo",
        "drewsephski/promptmarket",
        "--base",
        "main",
        "--head",
        "octocat:recipe/sample-agent-0.1.0",
        "--title",
        "Add sample-agent@0.1.0",
        "--body-file",
        `${workspace}.pr-body.md`,
      ],
    ]);
    expect(body).toContain("sample-agent@0.1.0");
    expect(body).toContain(result.plan.integrity);
    expect(body).toContain("cursor, codex");
    expect(body).toContain("github.com");
  });

  test("refuses to overwrite a version that is already in the checkout", async function refusesOverwrite() {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-workspace-"),
    );
    tempDirs.push(workspace);
    await mkdir(path.join(workspace, "recipes", "sample-agent", "0.1.0"), {
      recursive: true,
    });
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    await expect(
      submitRecipe(await recipeDir(), {
        registry: registryWith([]),
        runner: scriptedRunner(calls),
        workspaceDir: workspace,
      }),
    ).rejects.toThrow("Refusing to overwrite recipes/sample-agent/0.1.0");
    expect(
      calls.some(function committed(call) {
        return call.command === "git" && call.args[0] === "commit";
      }),
    ).toBe(false);
  });
});
