import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { digestFiles } from "./digest.js";
import { RecipeNotFoundError, RecipeVersionNotFoundError } from "./errors.js";
import { assertPackageWithinLimits } from "./remote-registry.js";
import {
  normalizeRecipeFiles,
  readRecipeFiles,
  writeRecipeFiles,
} from "./recipe-files.js";
import {
  createProcessRunner,
  type ProcessResult,
  type ProcessRunner,
} from "./process-runner.js";
import type { RecipeFile, RecipeIssue, Registry } from "./types.js";
import { validateRecipe } from "./validate-recipe.js";

export const UPSTREAM_REPOSITORY = "drewsephski/promptmarket";
export const UPSTREAM_BASE = "main";

export class SubmitError extends Error {
  readonly code: string;
  readonly issues: RecipeIssue[];

  constructor(code: string, message: string, issues: RecipeIssue[] = []) {
    super(message);
    this.name = "SubmitError";
    this.code = code;
    this.issues = issues;
  }
}

export type SubmitPlan = {
  name: string;
  version: string;
  description: string;
  integrity: string;
  compatibility: string[];
  capabilities: {
    filesystem: "none" | "read" | "write";
    shell: boolean;
    network: string[];
  };
  mcp: string[];
  files: string[];
  fileCount: number;
  bytes: number;
  destination: string;
  branch: string;
  base: string;
  upstream: string;
};

export type SubmitResult = {
  ok: true;
  dryRun: boolean;
  plan: SubmitPlan;
  prUrl?: string;
};

export function recipeBranchName(name: string, version: string): string {
  return `recipe/${name}-${version.replaceAll("+", "-")}`;
}

function packageBytes(files: RecipeFile[]): number {
  return files.reduce(function sum(total, file) {
    return total + file.contents.byteLength;
  }, 0);
}

function sortedPaths(files: RecipeFile[]): string[] {
  return files
    .map(function pathOf(file) {
      return file.path;
    })
    .sort(function byPath(left, right) {
      if (left < right) {
        return -1;
      }
      if (left > right) {
        return 1;
      }
      return 0;
    });
}

export function renderPullRequestBody(plan: SubmitPlan): string {
  const network =
    plan.capabilities.network.length > 0
      ? plan.capabilities.network.join(", ")
      : "none";
  const mcp = plan.mcp.length > 0 ? plan.mcp.join(", ") : "none";
  const files = plan.files.map(function item(file) {
    return `- \`${file}\``;
  });
  return [
    `## ${plan.name}@${plan.version}`,
    "",
    plan.description,
    "",
    `- Integrity: \`${plan.integrity}\``,
    `- Compatibility: ${plan.compatibility.join(", ")}`,
    `- Filesystem: ${plan.capabilities.filesystem}`,
    `- Shell: ${plan.capabilities.shell ? "yes" : "no"}`,
    `- Network: ${network}`,
    `- MCP dependencies: ${mcp}`,
    "",
    "### Files",
    "",
    ...files,
    "",
    "### Validation",
    "",
    "- [x] Schema valid",
    "- [x] Agent Skill frontmatter valid",
    "- [x] Name and version match the destination path",
    "- [x] Package paths and size limits checked",
    "- [x] Integrity computed with the registry digest",
    "",
    "This pull request adds an immutable recipe version. After it merges, that version directory cannot be changed.",
    "",
  ].join("\n");
}

async function assertCommand(
  runner: ProcessRunner,
  command: string,
  args: readonly string[],
  cwd: string | undefined,
  failure: string,
): Promise<ProcessResult> {
  const result = await runner.run(command, args, cwd ? { cwd } : undefined);
  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new SubmitError(
      "command_failed",
      detail.length > 0 ? `${failure}\n${detail}` : failure,
    );
  }
  return result;
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    const info = await stat(directory);
    return info.isDirectory();
  } catch {
    return false;
  }
}

export async function submitRecipe(
  recipePath: string,
  options: {
    dryRun?: boolean;
    registry: Registry;
    runner?: ProcessRunner;
    workspaceDir?: string;
    upstream?: string;
  },
): Promise<SubmitResult> {
  const validation = await validateRecipe(recipePath);
  if (!validation.ok) {
    throw new SubmitError(
      "invalid_recipe",
      "Recipe failed validation.",
      validation.errors,
    );
  }

  const files = normalizeRecipeFiles(await readRecipeFiles(recipePath));
  assertPackageWithinLimits(files);
  const recipe = validation.recipe;
  const name = recipe.manifest.name;
  const version = recipe.manifest.version;
  try {
    await options.registry.get(name, version);
    throw new SubmitError(
      "version_exists",
      `Recipe version already exists: ${name}@${version}`,
    );
  } catch (error) {
    if (error instanceof SubmitError) {
      throw error;
    }
    if (
      !(error instanceof RecipeNotFoundError) &&
      !(error instanceof RecipeVersionNotFoundError)
    ) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SubmitError(
        "registry_unreachable",
        `Could not check the registry for ${name}@${version}: ${message}`,
      );
    }
  }

  const plan: SubmitPlan = {
    name,
    version,
    description: recipe.skill.description,
    integrity: digestFiles(files),
    compatibility: [...recipe.manifest.compatibility],
    capabilities: {
      filesystem: recipe.manifest.capabilities.filesystem,
      shell: recipe.manifest.capabilities.shell,
      network: [...recipe.manifest.capabilities.network],
    },
    mcp: [...recipe.manifest.requires.mcp],
    files: sortedPaths(files),
    fileCount: files.length,
    bytes: packageBytes(files),
    destination: `recipes/${name}/${version}`,
    branch: recipeBranchName(name, version),
    base: UPSTREAM_BASE,
    upstream: options.upstream ?? UPSTREAM_REPOSITORY,
  };

  if (options.dryRun) {
    return { ok: true, dryRun: true, plan };
  }

  const runner = options.runner ?? createProcessRunner();
  const versionCheck = await runner.run("gh", ["--version"]);
  if (versionCheck.code !== 0) {
    throw new SubmitError(
      "gh_missing",
      "GitHub CLI (gh) is not available. Install it from https://cli.github.com, run `gh auth login`, and retry `promptmarket submit`.",
    );
  }
  const auth = await runner.run("gh", ["auth", "status"]);
  if (auth.code !== 0) {
    throw new SubmitError(
      "gh_unauthenticated",
      "GitHub CLI is not authenticated. Run `gh auth login`, then retry `promptmarket submit`.",
    );
  }

  const user = await assertCommand(
    runner,
    "gh",
    ["api", "user", "--jq", ".login"],
    undefined,
    "Could not determine the GitHub username with `gh api user`.",
  );
  const login = user.stdout.trim();
  if (login.length === 0) {
    throw new SubmitError(
      "gh_unauthenticated",
      "GitHub CLI did not return a username. Run `gh auth login`, then retry `promptmarket submit`.",
    );
  }

  await assertCommand(
    runner,
    "gh",
    ["repo", "fork", plan.upstream, "--clone=false"],
    undefined,
    `Could not fork ${plan.upstream}.`,
  );

  const workspace =
    options.workspaceDir ??
    (await mkdtemp(path.join(os.tmpdir(), "promptmarket-submit-")));
  const removeWorkspace = options.workspaceDir === undefined;
  try {
    await assertCommand(
      runner,
      "gh",
      ["repo", "clone", `${login}/promptmarket`, workspace],
      undefined,
      `Could not clone ${login}/promptmarket.`,
    );
    await assertCommand(
      runner,
      "git",
      ["remote", "add", "upstream", `https://github.com/${plan.upstream}.git`],
      workspace,
      "Could not add the upstream remote.",
    );
    await assertCommand(
      runner,
      "git",
      ["fetch", "upstream", plan.base],
      workspace,
      `Could not fetch ${plan.upstream} ${plan.base}.`,
    );
    await assertCommand(
      runner,
      "git",
      ["checkout", "-B", plan.branch, `upstream/${plan.base}`],
      workspace,
      `Could not create branch ${plan.branch}.`,
    );

    const destination = path.join(workspace, "recipes", name, version);
    if (await directoryExists(destination)) {
      throw new SubmitError(
        "destination_exists",
        `Refusing to overwrite ${plan.destination}.`,
      );
    }
    await mkdir(path.dirname(destination), { recursive: true });
    await writeRecipeFiles(destination, files);

    await assertCommand(
      runner,
      "git",
      ["add", "--", plan.destination],
      workspace,
      "Could not stage the recipe.",
    );
    const committed = await runner.run(
      "git",
      ["commit", "-m", `Add ${name}@${version}`],
      { cwd: workspace },
    );
    if (committed.code !== 0) {
      const detail = committed.stderr.trim() || committed.stdout.trim();
      throw new SubmitError(
        "commit_failed",
        `Git could not create the commit. Configure git user.name and user.email, then retry.\n${detail}`,
      );
    }
    await assertCommand(
      runner,
      "git",
      ["push", "-u", "origin", plan.branch],
      workspace,
      `Could not push ${plan.branch} to ${login}/promptmarket.`,
    );

    const bodyFile = `${workspace}.pr-body.md`;
    await writeFile(bodyFile, renderPullRequestBody(plan));
    try {
      const pull = await assertCommand(
        runner,
        "gh",
        [
          "pr",
          "create",
          "--repo",
          plan.upstream,
          "--base",
          plan.base,
          "--head",
          `${login}:${plan.branch}`,
          "--title",
          `Add ${name}@${version}`,
          "--body-file",
          bodyFile,
        ],
        workspace,
        "Could not create the pull request.",
      );
      const prUrl = pull.stdout
        .split("\n")
        .map(function trim(line) {
          return line.trim();
        })
        .find(function isUrl(line) {
          return line.startsWith("https://github.com/");
        });
      if (!prUrl) {
        throw new SubmitError(
          "command_failed",
          "GitHub CLI did not return a pull request URL.",
        );
      }
      return { ok: true, dryRun: false, plan, prUrl };
    } finally {
      await rm(bodyFile, { force: true });
    }
  } finally {
    if (removeWorkspace) {
      await rm(workspace, { recursive: true, force: true });
    }
  }
}
