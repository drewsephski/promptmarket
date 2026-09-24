import { createInterface } from "node:readline/promises";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import {
  AGENT_COMPATIBILITY,
  FILESYSTEM_CAPABILITIES,
  InvalidRecipeError,
  SubmitError,
  digestFiles,
  normalizeRecipeFiles,
  packRecipe,
  readRecipeFiles,
  scaffoldInstructions,
  submitRecipe,
  validateRecipe,
  validateRecipeDraft,
  writeRecipeDraft,
  type ProcessRunner,
  type RecipeDraft,
  type RecipeIssue,
} from "@promptmarket/registry";
import type { DocumentationProvider } from "./documentation.js";
import { createRegistry } from "./registry-option.js";

export type CliDeps = {
  interactive?: boolean;
  prompt?: (question: string) => Promise<string>;
  runner?: ProcessRunner;
  contentFetch?: typeof fetch;
  contentCacheDir?: string;
  contentNow?: () => number;
  cursorAgent?: boolean;
  context7Handoff?: (root: string) => Promise<number>;
  documentationProvider?: DocumentationProvider;
  command?: (
    file: string,
    args: string[],
    cwd: string,
  ) => Promise<number>;
  git?: (args: string[], cwd: string) => Promise<string>;
  langfuseFetch?: typeof fetch;
};

type Io = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

type State = {
  exitCode: number;
};

type InitFlags = {
  description?: string;
  author?: string;
  authorUrl?: string;
  recipeVersion?: string;
  tags?: string;
  compatibility?: string;
  filesystem?: string;
  shell?: boolean;
  network?: string;
  mcp?: string;
  json?: boolean;
};

const AGENTS = new Set<string>(AGENT_COMPATIBILITY);
const FILESYSTEMS = new Set<string>(FILESYSTEM_CAPABILITIES);

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function splitList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map(function trim(item) {
      return item.trim();
    })
    .filter(function nonEmpty(item) {
      return item.length > 0;
    });
}

async function defaultPrompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function ask(
  prompt: (question: string) => Promise<string>,
  question: string,
  fallback?: string,
): Promise<string> {
  const answer = (await prompt(question)).trim();
  if (answer.length === 0 && fallback !== undefined) {
    return fallback;
  }
  return answer;
}

function packageBytes(files: Array<{ contents: Uint8Array }>): number {
  return files.reduce(function sum(total, file) {
    return total + file.contents.byteLength;
  }, 0);
}

async function assertWritableDirectory(directory: string): Promise<void> {
  try {
    const info = await stat(directory);
    if (!info.isDirectory()) {
      throw new Error(`Not a directory: ${directory}`);
    }
  } catch (error) {
    const code =
      error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT") {
      return;
    }
    if (error instanceof Error && error.message.startsWith("Not a directory")) {
      throw error;
    }
    throw error;
  }
  const entries = (await readdir(directory)).filter(function keep(name) {
    return name !== ".DS_Store";
  });
  if (entries.length > 0) {
    throw new Error(`Directory already exists and is not empty: ${directory}`);
  }
}

export async function resolveInitDraft(options: {
  directoryName: string;
  flags: InitFlags;
  interactive: boolean;
  prompt: (question: string) => Promise<string>;
}): Promise<
  | { ok: true; draft: RecipeDraft }
  | { ok: false; error: string; issues?: RecipeIssue[] }
> {
  const flags = options.flags;
  if (!options.interactive) {
    const missing: string[] = [];
    if (!flags.description?.trim()) {
      missing.push("--description");
    }
    if (!flags.author?.trim()) {
      missing.push("--author");
    }
    if (!flags.compatibility?.trim()) {
      missing.push("--compatibility");
    }
    if (missing.length > 0) {
      missing.sort(function byName(left, right) {
        if (left < right) {
          return -1;
        }
        if (left > right) {
          return 1;
        }
        return 0;
      });
      return {
        ok: false,
        error: `Missing required options: ${missing.join(", ")}`,
      };
    }
  }

  const name = options.interactive
    ? await ask(
        options.prompt,
        `Recipe name [${options.directoryName}]: `,
        options.directoryName,
      )
    : options.directoryName;
  if (name !== options.directoryName) {
    return {
      ok: false,
      error: `Recipe name must match the directory name "${options.directoryName}".`,
    };
  }

  const version = options.interactive
    ? await ask(
        options.prompt,
        `Version [${flags.recipeVersion ?? "0.1.0"}]: `,
        flags.recipeVersion ?? "0.1.0",
      )
    : (flags.recipeVersion ?? "0.1.0");
  const description = flags.description?.trim()
    ? flags.description
    : options.interactive
      ? await ask(options.prompt, "Description: ")
      : "";
  const author = flags.author?.trim()
    ? flags.author
    : options.interactive
      ? await ask(options.prompt, "Author: ")
      : "";
  const authorUrl = flags.authorUrl?.trim()
    ? flags.authorUrl.trim()
    : options.interactive
      ? await ask(options.prompt, "Author URL (optional): ")
      : "";
  const tags =
    flags.tags !== undefined
      ? splitList(flags.tags)
      : options.interactive
        ? splitList(await ask(options.prompt, "Tags (comma-separated): "))
        : [];
  const compatibility =
    flags.compatibility !== undefined
      ? splitList(flags.compatibility)
      : options.interactive
        ? splitList(
            await ask(
              options.prompt,
              "Compatibility (comma-separated) [generic]: ",
              "generic",
            ),
          )
        : [];
  const filesystem = flags.filesystem
    ? flags.filesystem
    : options.interactive
      ? await ask(
          options.prompt,
          "Filesystem capability (none, read, write) [none]: ",
          "none",
        )
      : "none";
  const shell = flags.shell
    ? true
    : options.interactive
      ? /^(y|yes)$/i.test(
          await ask(options.prompt, "Allow shell access? [y/N]: ", "n"),
        )
      : false;
  const network =
    flags.network !== undefined
      ? splitList(flags.network)
      : options.interactive
        ? splitList(
            await ask(options.prompt, "Network domains (comma-separated): "),
          )
        : [];
  const mcp =
    flags.mcp !== undefined
      ? splitList(flags.mcp)
      : options.interactive
        ? splitList(
            await ask(options.prompt, "MCP dependencies (comma-separated): "),
          )
        : [];

  const unknownAgents = compatibility.filter(function unknown(agent) {
    return !AGENTS.has(agent);
  });
  if (unknownAgents.length > 0 || compatibility.length === 0) {
    return {
      ok: false,
      error:
        `Compatibility must list one or more of: ${AGENT_COMPATIBILITY.join(", ")}.`,
      issues: [
        {
          code: "compatibility_invalid",
          path: "compatibility",
          message:
            `Compatibility must list one or more of: ${AGENT_COMPATIBILITY.join(", ")}.`,
        },
      ],
    };
  }
  if (!FILESYSTEMS.has(filesystem)) {
    return {
      ok: false,
      error: "Filesystem capability must be none, read, or write.",
      issues: [
        {
          code: "filesystem_invalid",
          path: "capabilities.filesystem",
          message: "Filesystem capability must be none, read, or write.",
        },
      ],
    };
  }

  const draft: RecipeDraft = {
    name,
    version,
    description,
    author: {
      name: author,
      ...(authorUrl.length > 0 ? { url: authorUrl } : {}),
    },
    compatibility: compatibility as RecipeDraft["compatibility"],
    tags,
    requires: { mcp },
    capabilities: {
      filesystem: filesystem as RecipeDraft["capabilities"]["filesystem"],
      shell,
      network,
    },
    instructions: scaffoldInstructions(name, description),
  };
  const validation = validateRecipeDraft(draft);
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.issues
        .map(function format(issue) {
          return issue.message;
        })
        .join("; "),
      issues: validation.issues,
    };
  }
  return { ok: true, draft };
}

function writeIssues(io: Io, issues: RecipeIssue[]): void {
  for (const issue of issues) {
    io.stderr(`${issue.path}: ${issue.message} [${issue.code}]\n`);
  }
}

export function registerAuthorCommands(
  program: Command,
  io: Io,
  state: State,
  deps: CliDeps,
): void {
  program
    .command("init")
    .description("Create a local recipe authoring directory")
    .argument("<directory>", "Directory to create")
    .option("--description <text>", "Recipe description")
    .option("--author <name>", "Author name")
    .option("--author-url <url>", "Author URL")
    .option("--recipe-version <semver>", "Recipe version (default: 0.1.0)")
    .option("--tags <list>", "Comma-separated tags")
    .option("--compatibility <list>", "Comma-separated agents")
    .option("--filesystem <mode>", "none, read, or write")
    .option("--shell", "Allow shell access")
    .option("--network <list>", "Comma-separated network domains")
    .option("--mcp <list>", "Comma-separated MCP dependency IDs")
    .option("--json", "Print deterministic JSON to stdout")
    .action(async function initAction(directory: string, flags: InitFlags) {
      const interactive =
        deps.interactive ??
        (process.stdin.isTTY === true && flags.json !== true);
      const prompt = deps.prompt ?? defaultPrompt;
      try {
        const directoryName = path.basename(path.resolve(directory));
        const resolved = await resolveInitDraft({
          directoryName,
          flags,
          interactive,
          prompt,
        });
        if (!resolved.ok) {
          state.exitCode = 1;
          if (flags.json) {
            io.stdout(
              json({
                ok: false,
                error: resolved.error,
                ...(resolved.issues ? { issues: resolved.issues } : {}),
              }),
            );
            return;
          }
          io.stderr(`${resolved.error}\n`);
          return;
        }
        const target = path.resolve(directory);
        await assertWritableDirectory(target);
        await writeRecipeDraft(target, resolved.draft);
        const payload = {
          ok: true,
          path: target,
          name: resolved.draft.name,
          version: resolved.draft.version,
          files: ["promptmarket.yaml", "SKILL.md"],
        };
        if (flags.json) {
          io.stdout(json(payload));
          return;
        }
        io.stdout(`created ${payload.name}\n${payload.path}\n`);
      } catch (error) {
        state.exitCode = 1;
        const message = error instanceof Error ? error.message : String(error);
        if (flags.json) {
          io.stdout(json({ ok: false, error: message }));
          return;
        }
        io.stderr(`${message}\n`);
      }
    });

  program
    .command("check")
    .description("Validate a recipe and print author feedback")
    .argument("<path>", "Path to a recipe directory")
    .option("--json", "Print deterministic JSON to stdout")
    .action(async function checkAction(
      recipePath: string,
      options: { json?: boolean },
    ) {
      try {
        const result = await validateRecipe(recipePath);
        if (!result.ok) {
          state.exitCode = 1;
          if (options.json) {
            io.stdout(json({ ok: false, issues: result.errors }));
            return;
          }
          writeIssues(io, result.errors);
          return;
        }
        const files = normalizeRecipeFiles(await readRecipeFiles(recipePath));
        const payload = {
          ok: true,
          name: result.recipe.manifest.name,
          version: result.recipe.manifest.version,
          integrity: digestFiles(files),
          fileCount: files.length,
          bytes: packageBytes(files),
          issues: [],
        };
        if (options.json) {
          io.stdout(json(payload));
          return;
        }
        io.stdout(
          `valid ${payload.name}@${payload.version}\nintegrity: ${payload.integrity}\nfiles: ${payload.fileCount}\nbytes: ${payload.bytes}\n`,
        );
      } catch (error) {
        state.exitCode = 1;
        const message = error instanceof Error ? error.message : String(error);
        if (options.json) {
          io.stdout(json({ ok: false, error: message }));
          return;
        }
        io.stderr(`${message}\n`);
      }
    });

  program
    .command("pack")
    .description("Validate a recipe and write a deterministic .tgz")
    .argument("<path>", "Path to a recipe directory")
    .option("--out <dir>", "Directory for the archive")
    .option("--json", "Print deterministic JSON to stdout")
    .action(async function packAction(
      recipePath: string,
      options: { out?: string; json?: boolean },
    ) {
      try {
        const packed = await packRecipe(recipePath, {
          outDir: options.out,
        });
        if (options.json) {
          io.stdout(json({ ok: true, ...packed }));
          return;
        }
        io.stdout(
          [
            `name: ${packed.name}`,
            `version: ${packed.version}`,
            `integrity: ${packed.integrity}`,
            `files: ${packed.fileCount}`,
            `bytes: ${packed.bytes}`,
            `artifact: ${packed.artifactPath}`,
            "",
          ].join("\n"),
        );
      } catch (error) {
        state.exitCode = 1;
        if (error instanceof InvalidRecipeError) {
          if (options.json) {
            io.stdout(
              json({ ok: false, error: error.message, issues: error.issues }),
            );
            return;
          }
          writeIssues(io, error.issues);
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (options.json) {
          io.stdout(json({ ok: false, error: message }));
          return;
        }
        io.stderr(`${message}\n`);
      }
    });

  program
    .command("submit")
    .description(
      "Open a GitHub pull request for a new immutable recipe version",
    )
    .argument("<path>", "Path to a recipe directory")
    .option(
      "--dry-run",
      "Validate and check the registry without creating a PR",
    )
    .option("--json", "Print deterministic JSON to stdout")
    .option(
      "--recipes <dir>",
      "Check versions against a local recipe directory",
    )
    .option("--registry <url>", "Registry API base URL")
    .action(async function submitAction(
      recipePath: string,
      options: {
        dryRun?: boolean;
        json?: boolean;
        recipes?: string;
        registry?: string;
      },
    ) {
      try {
        const result = await submitRecipe(recipePath, {
          dryRun: options.dryRun,
          registry: createRegistry(options),
          runner: deps.runner,
        });
        if (options.json) {
          io.stdout(json(result));
          return;
        }
        const plan = result.plan;
        io.stdout(
          [
            `name: ${plan.name}`,
            `version: ${plan.version}`,
            `integrity: ${plan.integrity}`,
            `destination: ${plan.destination}`,
            `branch: ${plan.branch}`,
            "files:",
            ...plan.files.map(function line(file) {
              return `  ${file}`;
            }),
            "",
          ].join("\n"),
        );
        if (result.dryRun) {
          io.stdout("Dry run: no pull request created.\n");
          return;
        }
        io.stdout(`${result.prUrl}\n`);
      } catch (error) {
        state.exitCode = 1;
        if (error instanceof SubmitError) {
          if (options.json) {
            io.stdout(
              json({
                ok: false,
                error: error.message,
                ...(error.issues.length > 0 ? { issues: error.issues } : {}),
              }),
            );
            return;
          }
          io.stderr(`${error.message}\n`);
          if (error.issues.length > 0) {
            writeIssues(io, error.issues);
          }
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (options.json) {
          io.stdout(json({ ok: false, error: message }));
          return;
        }
        io.stderr(`${message}\n`);
      }
    });
}
