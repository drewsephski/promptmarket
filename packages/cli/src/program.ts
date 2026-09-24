import { Command, CommanderError } from "commander";
import {
  buildContext,
  buildPlan,
  ContentNotFoundError,
  detectProject,
  doctorGuides,
  formatAgentContext,
  formatPlan,
  formatCompatibility,
  formatContextText,
  otherProjectLabels,
  type ContentCatalog,
  type ContextDetail,
  type ProjectContext,
  type PromptDocument,
} from "@promptmarket/content";
import {
  applyCursorSetup,
  context7Configured,
  CONTEXT7_SETUP_COMMAND,
  cursorAgentInstalled,
  handoffContext7,
  inspectCursorSetup,
  planCursorSetup,
  renderSetupReport,
  type SetupMode,
} from "./cursor-setup.js";
import { groundPlan } from "./documentation.js";
import {
  createContext7Provider,
  missingResearchCredentialsMessage,
  researchCredentials,
} from "./context7-provider.js";
import { CLI_VERSION, resolveContent } from "./content-source.js";
import {
  findOutdatedRecipes,
  installFromLockfile,
  installRecipe,
  parseRecipeRef,
  validateRecipe,
  type Recipe,
} from "@promptmarket/registry";
import { registerAuthorCommands, type CliDeps } from "./author-commands.js";
import { createRegistry } from "./registry-option.js";

export type { CliDeps } from "./author-commands.js";
export { createRegistry } from "./registry-option.js";

export type CliIo = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

const defaultIo: CliIo = {
  stdout: function writeStdout(message: string) {
    process.stdout.write(message);
  },
  stderr: function writeStderr(message: string) {
    process.stderr.write(message);
  },
};

type CommandState = {
  exitCode: number;
};

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function summarizeRecipe(recipe: {
  name: string;
  version: string;
  description: string;
  tags: string[];
  compatibility: Recipe["manifest"]["compatibility"];
}) {
  return {
    name: recipe.name,
    version: recipe.version,
    description: recipe.description,
    tags: recipe.tags,
    compatibility: recipe.compatibility,
  };
}

function inspectRecipe(recipe: Recipe) {
  return {
    name: recipe.manifest.name,
    version: recipe.manifest.version,
    description: recipe.skill.description,
    author: recipe.manifest.author,
    compatibility: recipe.manifest.compatibility,
    requires: recipe.manifest.requires,
    capabilities: recipe.manifest.capabilities,
    entrypoint: recipe.manifest.entrypoint,
    tags: recipe.manifest.tags,
    skill: recipe.skill,
  };
}

function majorOf(version: string | undefined): string | undefined {
  if (!version) {
    return undefined;
  }
  return version.split(".")[0];
}

function withVersion(label: string, version: string | undefined): string {
  const major = majorOf(version);
  return major ? `${label} ${major}` : label;
}

function formatProject(project: ProjectContext): string {
  const lines = [
    `Framework       ${project.framework ?? "unknown"}`,
    `Language        ${project.language ?? "unknown"}`,
    `Package manager ${project.packageManager ?? "unknown"}`,
  ];
  const ai = [
    project.ai?.sdk
      ? withVersion(project.ai.sdk, project.versions.ai)
      : undefined,
    project.ai?.provider
      ? project.ai.provider
          .split(", ")
          .map(function versioned(name) {
            if (name === "OpenRouter") {
              return withVersion(
                "OpenRouter provider",
                project.versions["@openrouter/ai-sdk-provider"],
              );
            }
            return name;
          })
          .join(", ")
      : undefined,
  ].filter(function present(value): value is string {
    return Boolean(value);
  });
  if (ai.length > 0) {
    lines.push("", "AI", ...ai);
  }
  const database = [...(project.database ?? []), ...(project.orm ?? [])];
  if (database.length > 0) {
    lines.push("", "Database", ...database);
  }
  const other = otherProjectLabels(project);
  if (other.length > 0) {
    lines.push("", "Other", ...other);
  }
  return lines.join("\n");
}

function formatDoctor(
  project: ProjectContext,
  guides: ReturnType<typeof doctorGuides>,
): string {
  const lines = ["PromptMarket Doctor", "", "Project"];
  for (const label of [project.framework, project.language, project.packageManager]) {
    if (label) {
      lines.push(label);
    }
  }
  const ai = [
    project.ai?.sdk ? withVersion(project.ai.sdk, project.versions.ai) : undefined,
    project.ai?.provider?.split(", ").includes("OpenRouter")
      ? withVersion(
          "OpenRouter provider",
          project.versions["@openrouter/ai-sdk-provider"],
        )
      : project.ai?.provider,
  ].filter(function present(value): value is string {
    return Boolean(value);
  });
  if (ai.length > 0) {
    lines.push("", "AI", ...ai);
  }
  const database = [...(project.database ?? []), ...(project.orm ?? [])];
  if (database.length > 0) {
    lines.push("", "Database", ...database);
  }
  lines.push("");
  if (guides.length === 0) {
    lines.push(
      "Relevant compatibility",
      "No guide shares a detected AI, database, or ORM package.",
      "",
    );
    return `${lines.join("\n")}\n`;
  }
  lines.push("Relevant compatibility", "");
  for (const guide of guides) {
    lines.push(guide.title, "");
    if (guide.compatibility.length === 0) {
      lines.push("No tested package lines on this guide.", "");
      continue;
    }
    lines.push(...formatCompatibility(guide.compatibility), "");
  }
  const suggestion = guides[0]?.suggestion;
  if (suggestion) {
    lines.push("Suggested context:", suggestion, "");
  }
  return `${lines.join("\n")}\n`;
}

const SITE_ORIGIN = "https://promptmarket.sh";

type ContentFlags = {
  offline?: boolean;
  refresh?: boolean;
  contentApi?: string;
  content?: string;
};

async function openContent(
  flags: ContentFlags,
  deps: CliDeps,
): Promise<{ catalog: ContentCatalog; source: string; version: string }> {
  return resolveContent({
    offline: flags.offline,
    refresh: flags.refresh,
    contentDir: flags.content,
    contentApi: flags.contentApi,
    cacheDir: deps.contentCacheDir,
    fetch: deps.contentFetch,
    now: deps.contentNow,
  });
}

function writeFailure(
  io: CliIo,
  state: CommandState,
  asJson: boolean,
  error: unknown,
): void {
  state.exitCode = 1;
  const message = errorMessage(error);
  if (asJson) {
    io.stdout(json({ ok: false, error: message }));
    return;
  }
  io.stderr(`${message}\n`);
}

export function createProgram(
  io: CliIo,
  state: CommandState,
  deps: CliDeps = {},
): Command {
  const program = new Command();
  program
    .name("promptmarket")
    .description(
      "Search the PromptMarket catalog, assemble context, or install skills",
    )
    .version(CLI_VERSION)
    .configureOutput({
      writeOut: function writeOut(message: string) {
        io.stdout(message);
      },
      writeErr: function writeErr(message: string) {
        io.stderr(message);
      },
    })
    .exitOverride();

  program
    .command("search")
    .description("Search guides, lessons, prompts, and skills")
    .argument("<query>", "Search query")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--recipes <dir>", "Read recipes from a local directory")
    .option("--registry <url>", "Registry API base URL")
    .option("--content <dir>", "Read lessons and prompts from a directory")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .action(async function searchAction(
      query: string,
      options: {
        json?: boolean;
        recipes?: string;
        registry?: string;
        content?: string;
        offline?: boolean;
        refresh?: boolean;
        contentApi?: string;
      },
    ) {
      try {
        const { catalog } = await openContent(options, deps);
        const guides = catalog.searchGuides(query);
        const lessons = catalog.searchTopics(query);
        const prompts = catalog.searchPrompts(query);
        const recipes = await createRegistry(options).search(query);
        const summaries = recipes.map(summarizeRecipe);
        if (options.json) {
          io.stdout(
            json({
              ok: true,
              query,
              guides: guides.map(function summarizeGuideHit(guide) {
                return {
                  slug: guide.slug,
                  title: guide.title,
                  description: guide.description,
                };
              }),
              lessons: lessons.map(function summarizeLessonHit(lesson) {
                return {
                  slug: lesson.slug,
                  title: lesson.title,
                  summary: lesson.summary,
                };
              }),
              prompts: prompts.map(function summarizePromptHit(prompt) {
                return {
                  name: prompt.name,
                  title: prompt.title,
                  description: prompt.description,
                  category: prompt.category,
                  tags: prompt.tags,
                };
              }),
              recipes: summaries,
            }),
          );
          return;
        }
        const sections: Array<[string, string[]]> = [
          [
            "GUIDES",
            guides.map(function line(guide) {
              return `${guide.slug}\n${guide.title}`;
            }),
          ],
          [
            "LESSONS",
            lessons.map(function line(lesson) {
              return `${lesson.slug}\n${lesson.title}`;
            }),
          ],
          [
            "PROMPTS",
            prompts.map(function line(prompt) {
              return `${prompt.name}\n${prompt.title}`;
            }),
          ],
          [
            "SKILLS",
            summaries.map(function line(recipe) {
              return `${recipe.name}\t${recipe.version}\n${recipe.description}`;
            }),
          ],
        ];
        const visible = sections.filter(function hasHits(section) {
          return section[1].length > 0;
        });
        if (visible.length === 0) {
          io.stdout("No guides, lessons, prompts, or skills matched.\n");
          return;
        }
        for (const [heading, lines] of visible) {
          io.stdout(`${heading}\n${lines.join("\n")}\n`);
        }
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("context")
    .description("Assemble lessons, prompts, guides, and skills for a feature")
    .argument("<query>", "Feature description")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--detail <level>", "compact or full", "compact")
    .option("--format <format>", "text, agent, or json", "text")
    .option("--max-items <count>", "Maximum items in each collection", "5")
    .option("--recipes <dir>", "Read recipes from a local directory")
    .option("--registry <url>", "Registry API base URL")
    .option("--project <dir>", "Detect the project at this directory and tailor context")
    .option(
      "--content <dir>",
      "Read lessons, prompts, and guides from a directory",
    )
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .action(async function contextAction(
      query: string,
      options: {
        json?: boolean;
        detail?: string;
        format?: string;
        maxItems?: string;
        recipes?: string;
        registry?: string;
        content?: string;
        offline?: boolean;
        refresh?: boolean;
        contentApi?: string;
        project?: string;
      },
    ) {
      try {
        const detail = options.detail === "full" ? "full" : "compact";
        if (
          options.detail &&
          options.detail !== "compact" &&
          options.detail !== "full"
        ) {
          throw new Error('Expected --detail to be "compact" or "full"');
        }
        if (
          options.format &&
          options.format !== "text" &&
          options.format !== "agent" &&
          options.format !== "json"
        ) {
          throw new Error('Expected --format to be "text", "agent", or "json"');
        }
        const maxItems = Number(options.maxItems);
        const { catalog } = await openContent(options, deps);
        const project = options.project
          ? detectProject(options.project)
          : undefined;
        const recipes = await createRegistry(options).search(query);
        const context = buildContext(catalog, {
          query,
          detail: detail as ContextDetail,
          maxItems,
          project,
          skills: recipes.map(function skill(recipe) {
            return {
              name: recipe.name,
              version: recipe.version,
              description: recipe.description,
              tags: recipe.tags,
            };
          }),
        });
        if (options.json || options.format === "json") {
          io.stdout(json({ ok: true, ...context }));
          return;
        }
        io.stdout(
          options.format === "agent"
            ? formatAgentContext(context)
            : formatContextText(context),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("plan")
    .description(
      "Turn a feature description into an implementation plan without calling a model",
    )
    .argument("<query>", "Feature to plan, in plain language")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--project <dir>", "Tailor the plan to a project directory")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function planAction(
      query: string,
      options: {
        json?: boolean;
        project?: string;
        offline?: boolean;
        refresh?: boolean;
        contentApi?: string;
        content?: string;
      },
    ) {
      try {
        const { catalog } = await openContent(options, deps);
        const project = options.project
          ? detectProject(options.project)
          : undefined;
        const plan = buildPlan(catalog, { query, project });
        if (options.json) {
          io.stdout(json({ ok: true, ...plan }));
          return;
        }
        io.stdout(formatPlan(plan));
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("research")
    .description(
      "Optional. Reconcile a PromptMarket plan with live Context7 docs. Requires API keys.",
    )
    .argument("<query>", "Feature to research, in plain language")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--project <dir>", "Tailor the plan to a project directory")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function researchAction(
      query: string,
      options: {
        json?: boolean;
        project?: string;
        offline?: boolean;
        refresh?: boolean;
        contentApi?: string;
        content?: string;
      },
    ) {
      try {
        const provider =
          deps.documentationProvider ??
          (researchCredentials() ? await createContext7Provider() : undefined);
        if (!provider) {
          throw new Error(missingResearchCredentialsMessage());
        }
        const { catalog } = await openContent(options, deps);
        const project = options.project
          ? detectProject(options.project)
          : undefined;
        const plan = buildPlan(catalog, { query, project });
        const verified = await groundPlan(plan, provider);
        if (options.json) {
          io.stdout(json({ ok: true, ...verified }));
          return;
        }
        io.stdout(formatPlan(verified.plan));
        io.stdout("Verified plan\nEvidence from Context7. PromptMarket did not replace the guide.\n");
        for (const item of verified.evidence) {
          io.stdout(`${item.library} (${item.package})\n${item.question}\n`);
          if (item.documentation) {
            io.stdout(`${item.documentation}\n`);
          }
          io.stdout("\n");
        }
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("doctor")
    .description("Compare detected package versions with guide compatibility")
    .argument("[dir]", "Project directory", ".")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--offline", "Use the bundled content snapshot")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function doctorAction(
      dir: string,
      options: {
        json?: boolean;
        offline?: boolean;
        contentApi?: string;
        content?: string;
      },
    ) {
      try {
        const project = detectProject(dir);
        const { catalog } = await openContent(options, deps);
        const guides = doctorGuides(catalog, project);
        if (options.json) {
          io.stdout(json({ ok: true, project, guides }));
          return;
        }
        io.stdout(formatDoctor(project, guides));
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  const setup = program
    .command("setup")
    .description("Install PromptMarket into a coding agent");

  setup
    .command("cursor")
    .description("Add the PromptMarket MCP server and project rule for Cursor")
    .option("--write", "Write .cursor/mcp.json and .cursor/rules/promptmarket.mdc")
    .option("--dry-run", "Print the changes without writing files")
    .option("--remove", "Remove the PromptMarket MCP server and project rule")
    .option("--check", "Report whether Cursor is configured for PromptMarket")
    .option(
      "--with-context7",
      "Hand off to Context7's official Cursor setup when it is not already configured",
    )
    .option("--dir <dir>", "Project directory", ".")
    .action(async function setupCursorAction(options: {
      write?: boolean;
      dryRun?: boolean;
      remove?: boolean;
      check?: boolean;
      withContext7?: boolean;
      dir: string;
    }) {
      const selected = [options.write, options.dryRun, options.remove, options.check].filter(
        Boolean,
      ).length;
      if (selected > 1) {
        writeFailure(
          io,
          state,
          false,
          new Error("Use only one of --write, --dry-run, --remove, or --check"),
        );
        return;
      }
      const mode: SetupMode = options.write
        ? "write"
        : options.remove
          ? "remove"
          : options.check
            ? "check"
            : "dry-run";
      try {
        const agentHint =
          mode === "check" ? (deps.cursorAgent ?? cursorAgentInstalled()) : false;
        const report = await planCursorSetup(options.dir, mode, agentHint);
        if (mode === "write" || mode === "remove") {
          await applyCursorSetup(options.dir, mode);
        }
        io.stdout(renderSetupReport(report));
        if (options.withContext7 && mode !== "remove") {
          const inspected = await inspectCursorSetup(options.dir, mode);
          const configured = context7Configured(inspected.mcpConfig);
          const command = CONTEXT7_SETUP_COMMAND.join(" ");
          if (configured) {
            io.stdout("Context7\n  already configured\n");
          } else if (mode === "write") {
            io.stdout(`Context7\n  handoff\n  ${command}\n`);
            const handoff = deps.context7Handoff ?? handoffContext7;
            const code = await handoff(options.dir);
            if (code !== 0) {
              state.exitCode = code;
              io.stderr("Context7 setup did not finish. PromptMarket was still installed.\n");
            }
          } else {
            io.stdout(
              `Context7\n  not configured\n  Re-run with --write to hand off: ${command}\n`,
            );
          }
        }
        if (mode === "check" && !report.ready) {
          state.exitCode = 1;
        }
      } catch (error) {
        writeFailure(io, state, false, error);
      }
    });

  program
    .command("detect")
    .description("Detect the framework and dependencies in a project directory")
    .argument("[dir]", "Project directory", ".")
    .option("--json", "Print deterministic JSON to stdout")
    .action(function detectAction(dir: string, options: { json?: boolean }) {
      const project = detectProject(dir);
      if (options.json) {
        io.stdout(json({ ok: true, project }));
        return;
      }
      io.stdout(`${formatProject(project)}\n`);
    });

  program
    .command("info")
    .description(
      "Show CLI and content versions, or inspect one recipe at an optional version",
    )
    .argument("[recipe]", "Recipe name or name@version")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--recipes <dir>", "Read recipes from a local directory")
    .option("--registry <url>", "Registry API base URL")
    .option("--offline", "Use the bundled content snapshot")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read content from a directory")
    .action(async function infoAction(
      name: string | undefined,
      options: {
        json?: boolean;
        recipes?: string;
        registry?: string;
        offline?: boolean;
        contentApi?: string;
        content?: string;
      },
    ) {
      try {
        if (!name) {
          const content = await openContent(options, deps);
          const payload = {
            cli: CLI_VERSION,
            contentSource: content.source,
            contentVersion: content.version,
            offlineSnapshot: "included",
          };
          if (options.json) {
            io.stdout(json({ ok: true, ...payload }));
            return;
          }
          io.stdout(
            [
              `PromptMarket CLI       ${payload.cli}`,
              `Content source         ${payload.contentSource}`,
              `Content version        ${payload.contentVersion}`,
              `Offline snapshot       ${payload.offlineSnapshot}`,
              "",
            ].join("\n"),
          );
          return;
        }
        const ref = parseRecipeRef(name);
        const recipe = await createRegistry(options).get(ref.name, ref.version);
        if (options.json) {
          io.stdout(json({ ok: true, recipe: inspectRecipe(recipe) }));
          return;
        }
        io.stdout(
          [
            `name: ${recipe.manifest.name}`,
            `version: ${recipe.manifest.version}`,
            `description: ${recipe.skill.description}`,
            "",
          ].join("\n"),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("validate")
    .description("Validate a recipe directory")
    .argument("<path>", "Path to a recipe directory")
    .option("--json", "Print deterministic JSON to stdout")
    .action(async function validateAction(
      recipePath: string,
      options: { json?: boolean },
    ) {
      try {
        const result = await validateRecipe(recipePath);
        if (result.ok) {
          if (options.json) {
            io.stdout(
              json({
                ok: true,
                name: result.recipe.manifest.name,
                version: result.recipe.manifest.version,
              }),
            );
            return;
          }
          io.stdout(`valid ${result.recipe.manifest.name}\n`);
          return;
        }

        state.exitCode = 1;
        if (options.json) {
          io.stdout(json({ ok: false, errors: result.errors }));
          return;
        }
        for (const issue of result.errors) {
          io.stderr(`${issue.path}: ${issue.message}\n`);
        }
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("add")
    .description(
      "Install a recipe into .agents/skills and record it in promptmarket.lock",
    )
    .argument("<recipe>", "Recipe name or name@version")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--recipes <dir>", "Read recipes from a local directory")
    .option("--registry <url>", "Registry API base URL")
    .option("--project <dir>", "Project directory to install into")
    .action(async function addAction(
      name: string,
      options: {
        json?: boolean;
        recipes?: string;
        registry?: string;
        project?: string;
      },
    ) {
      try {
        const installed = await installRecipe(name, {
          registry: createRegistry(options),
          projectDir: options.project,
        });
        if (options.json) {
          io.stdout(json({ ok: true, installed }));
          return;
        }
        io.stdout(
          `installed ${installed.name}@${installed.version}\n${installed.destination}\n`,
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("install")
    .description(
      "Install every recipe pinned in promptmarket.lock without changing the lockfile",
    )
    .option("--json", "Print deterministic JSON to stdout")
    .option(
      "--recipes <dir>",
      "Read file-sourced recipes from a local directory",
    )
    .option(
      "--project <dir>",
      "Project directory that contains promptmarket.lock",
    )
    .action(async function installAction(options: {
      json?: boolean;
      recipes?: string;
      project?: string;
    }) {
      try {
        const installed = await installFromLockfile({
          projectDir: options.project,
          recipesDir: options.recipes,
        });
        if (options.json) {
          io.stdout(json({ ok: true, installed }));
          return;
        }
        if (installed.length === 0) {
          io.stdout("Nothing to install.\n");
          return;
        }
        for (const recipe of installed) {
          io.stdout(
            `installed ${recipe.name}@${recipe.version}\n${recipe.destination}\n`,
          );
        }
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("versions")
    .description("List immutable versions of a recipe")
    .argument("<name>", "Recipe name")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--recipes <dir>", "Read recipes from a local directory")
    .option("--registry <url>", "Registry API base URL")
    .action(async function versionsAction(
      name: string,
      options: { json?: boolean; recipes?: string; registry?: string },
    ) {
      try {
        const listed = await createRegistry(options).listVersions(name);
        if (options.json) {
          io.stdout(json({ ok: true, ...listed }));
          return;
        }
        io.stdout(`${listed.name}\nlatest: ${listed.latest}\n`);
        for (const version of listed.versions) {
          io.stdout(`${version.version}\t${version.integrity}\n`);
        }
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("outdated")
    .description("Show locked recipes that are older than the registry latest")
    .option("--json", "Print deterministic JSON to stdout")
    .option(
      "--recipes <dir>",
      "Read file-sourced recipes from a local directory",
    )
    .option(
      "--project <dir>",
      "Project directory that contains promptmarket.lock",
    )
    .action(async function outdatedAction(options: {
      json?: boolean;
      recipes?: string;
      project?: string;
    }) {
      try {
        const outdated = await findOutdatedRecipes({
          projectDir: options.project,
          recipesDir: options.recipes,
        });
        if (options.json) {
          io.stdout(json({ ok: true, outdated }));
          return;
        }
        if (outdated.length === 0) {
          io.stdout("All locked recipes are current.\n");
          return;
        }
        for (const recipe of outdated) {
          io.stdout(`${recipe.name}\t${recipe.version}\t${recipe.latest}\n`);
        }
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("show")
    .description("Print a prompt, or a skill when the name is not a prompt")
    .argument("<name>", "Prompt or skill name")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--recipes <dir>", "Read recipes from a local directory")
    .option("--registry <url>", "Registry API base URL")
    .option("--content <dir>", "Read lessons and prompts from a directory")
    .option("--offline", "Use the bundled content snapshot")
    .option("--content-api <url>", "Content API base URL")
    .action(async function showAction(
      name: string,
      options: {
        json?: boolean;
        recipes?: string;
        registry?: string;
        content?: string;
        offline?: boolean;
        contentApi?: string;
      },
    ) {
      try {
        const { catalog } = await openContent(options, deps);
        let prompt: PromptDocument | undefined;
        try {
          prompt = catalog.getPrompt(name);
        } catch (error) {
          if (!(error instanceof ContentNotFoundError)) {
            throw error;
          }
        }
        if (prompt) {
          if (options.json) {
            io.stdout(
              json({
                ok: true,
                kind: "prompt",
                prompt: {
                  name: prompt.slug,
                  title: prompt.title,
                  description: prompt.description,
                  category: prompt.category,
                  variables: prompt.variables,
                  body: prompt.body,
                },
              }),
            );
            return;
          }
          io.stdout(
            [
              prompt.title,
              `${prompt.category} · ${prompt.difficulty}`,
              "",
              prompt.description,
              "",
              prompt.variables.length > 0
                ? `Variables: ${prompt.variables.join(", ")}`
                : "Variables: none",
              "",
              prompt.body,
              "",
            ].join("\n"),
          );
          return;
        }

        const ref = parseRecipeRef(name);
        const recipe = await createRegistry(options).get(ref.name, ref.version);
        if (options.json) {
          io.stdout(
            json({ ok: true, kind: "skill", recipe: inspectRecipe(recipe) }),
          );
          return;
        }
        io.stdout(
          [
            `name: ${recipe.manifest.name}`,
            `version: ${recipe.manifest.version}`,
            `description: ${recipe.skill.description}`,
            "",
            recipe.skill.body,
            "",
          ].join("\n"),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("learn")
    .description("Print a short lesson and its URL")
    .argument("<slug>", "Lesson slug, such as rag")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--content <dir>", "Read lessons and prompts from a directory")
    .option("--offline", "Use the bundled content snapshot")
    .option("--content-api <url>", "Content API base URL")
    .action(async function learnAction(
      slug: string,
      options: { json?: boolean; content?: string; offline?: boolean; contentApi?: string },
    ) {
      try {
        const { catalog } = await openContent(options, deps);
        const topic = catalog.getTopic(slug);
        const url = `${SITE_ORIGIN}${topic.href}`;
        if (options.json) {
          io.stdout(
            json({
              ok: true,
              topic: {
                slug: topic.slug,
                title: topic.title,
                definition: topic.definition,
                mentalModel: topic.mentalModel,
                url,
              },
            }),
          );
          return;
        }
        io.stdout(
          [
            topic.title,
            url,
            "",
            topic.definition,
            "",
            topic.mentalModel,
            "",
          ].join("\n"),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("guides")
    .description("List full-stack guides")
    .option("--json", "Print deterministic JSON to stdout")
    .option(
      "--content <dir>",
      "Read lessons, prompts, and guides from a directory",
    )
    .option("--offline", "Use the bundled content snapshot")
    .option("--content-api <url>", "Content API base URL")
    .action(async function guidesAction(options: {
      json?: boolean;
      content?: string;
      offline?: boolean;
      contentApi?: string;
    }) {
      try {
        const { catalog } = await openContent(options, deps);
        const guides = catalog.guides;
        if (options.json) {
          io.stdout(
            json({
              ok: true,
              guides: guides.map(function summarize(guide) {
                return {
                  slug: guide.slug,
                  title: guide.title,
                  description: guide.description,
                  difficulty: guide.difficulty,
                  url: `${SITE_ORIGIN}${guide.href}`,
                };
              }),
            }),
          );
          return;
        }
        if (guides.length === 0) {
          io.stdout("No guides yet.\n");
          return;
        }
        for (const guide of guides) {
          io.stdout(`${guide.slug}\n${guide.title}\n${guide.description}\n`);
        }
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("guide")
    .description("Print one guide's outline and URL")
    .argument("<slug>", "Guide slug, such as ai-product-brief-builder")
    .option("--json", "Print deterministic JSON to stdout")
    .option(
      "--content <dir>",
      "Read lessons, prompts, and guides from a directory",
    )
    .option("--offline", "Use the bundled content snapshot")
    .option("--content-api <url>", "Content API base URL")
    .action(async function guideAction(
      slug: string,
      options: { json?: boolean; content?: string; offline?: boolean; contentApi?: string },
    ) {
      try {
        const { catalog } = await openContent(options, deps);
        const guide = catalog.getGuide(slug);
        const url = `${SITE_ORIGIN}${guide.href}`;
        const sections = guide.sections.map(function summarize(section) {
          return { id: section.id, title: section.title };
        });
        if (options.json) {
          io.stdout(
            json({
              ok: true,
              guide: {
                slug: guide.slug,
                title: guide.title,
                description: guide.description,
                difficulty: guide.difficulty,
                stack: guide.stack,
                url,
                sections,
              },
            }),
          );
          return;
        }
        io.stdout(
          [
            guide.title,
            url,
            "",
            guide.description,
            "",
            ...sections.map(function line(section) {
              return section.title;
            }),
            "",
          ].join("\n"),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  registerAuthorCommands(program, io, state, deps);

  return program;
}

export async function run(
  argv: string[],
  io: CliIo = defaultIo,
  deps: CliDeps = {},
): Promise<number> {
  const state: CommandState = { exitCode: 0 };
  const program = createProgram(io, state, deps);
  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }
    state.exitCode = 1;
    io.stderr(`${errorMessage(error)}\n`);
  }
  return state.exitCode;
}
