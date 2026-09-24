import { Command, CommanderError } from "commander";
import {
  assessChangeImpact,
  assessFeature,
  attachPaths,
  buildContext,
  buildPlan,
  ContentNotFoundError,
  contractFromPlan,
  detectProject,
  doctorGuides,
  featureIdFromGoal,
  formatAgentContext,
  formatChangeImpact,
  formatChangeSummary,
  formatFeatureRefresh,
  formatFeatureReviews,
  formatFeatureStatus,
  formatFeatureSummary,
  formatPlan,
  formatCompatibility,
  formatContextText,
  otherProjectLabels,
  refreshFeature,
  reviewFeatureChange,
  type ContentCatalog,
  type ContextDetail,
  type FeatureAssessment,
  type FeatureContract,
  type FeatureGuideContext,
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
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
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
import {
  detectTelemetry,
  formatLangfuseSetup,
  formatObservation,
} from "./observe.js";
import { changedFilesSince, dependencyChangesSince } from "./changed-files.js";
import {
  featureEvidence,
  FEATURE_ROOT,
  readFeatureContracts,
  writeFeatureContract,
} from "./features.js";
import {
  includeProductionCases,
  listDatasetItems,
  productionCases,
  productionCasesYaml,
} from "./langfuse-sync.js";
import {
  EVAL_ROOT,
  EVAL_WORKFLOW,
  PROMPTFOO_EVAL,
  PROMPTFOO_VIEW,
  githubEvalWorkflow,
  runInherited,
  writeEvalSuite,
} from "./verify.js";

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

function collectPath(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

async function loadContracts(root: string): Promise<FeatureContract[]> {
  const loaded = await readFeatureContracts(root);
  const malformed = loaded.filter(function bad(item) {
    return "error" in item;
  });
  if (malformed.length > 0) {
    throw new Error(malformed.map(function message(item) {
      return "error" in item ? item.error : "Malformed feature contract";
    }).join("\n"));
  }
  return loaded.flatMap(function contractOf(item) {
    return "contract" in item ? [item.contract] : [];
  });
}

function guideContextFor(
  catalog: ContentCatalog,
  contract: FeatureContract,
): FeatureGuideContext {
  const guide = contract.guide
    ? catalog.guides.find(function same(item) {
        return item.slug === contract.guide;
      })
    : undefined;
  const docs = guide?.evidence.docs.map(function library(doc) {
    return doc.library;
  }) ?? [];
  return {
    docs: [...new Set(docs)],
    verification: guide?.verification ?? [],
  };
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
      "Optional. Reconcile a PromptMarket plan with live Context7 docs. Requires CONTEXT7_API_KEY.",
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
        io.stdout("Verified plan\nEvidence from the Context7 SDK. PromptMarket did not replace the guide.\n");
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

  const verify = program
    .command("verify")
    .description("Scaffold and run Promptfoo checks chosen by the plan");

  verify
    .command("init")
    .description("Write a thin Promptfoo suite from the plan's eval targets")
    .argument("<query>", "Feature to verify, in plain language")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--project <dir>", "Project directory", ".")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function verifyInitAction(
      query: string,
      options: {
        json?: boolean;
        project: string;
        offline?: boolean;
        refresh?: boolean;
        contentApi?: string;
        content?: string;
      },
    ) {
      try {
        const { catalog } = await openContent(options, deps);
        const project = detectProject(options.project);
        const plan = buildPlan(catalog, { query, project });
        const target = plan.evalTargets[0];
        if (!target) {
          throw new Error(
            "This plan has no eval target. PromptMarket only scaffolds checks a guide already names.",
          );
        }
        const directory = path.join(options.project, EVAL_ROOT, target.guide);
        try {
          await access(directory);
          throw new Error(
            `${path.join(EVAL_ROOT, target.guide)} already exists. Promptfoo owns that suite.`,
          );
        } catch (error) {
          if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
          }
        }
        const files = await writeEvalSuite(options.project, target, {
          tracing: plan.observabilityTargets.some(function langfuse(item) {
            return item.provider === "langfuse";
          }),
        });
        if (options.json) {
          io.stdout(
            json({
              ok: true,
              guide: target.guide,
              system: target.system,
              directory: path.join(EVAL_ROOT, target.guide),
              files,
            }),
          );
          return;
        }
        io.stdout(
          [
            `Eval ${target.system} · ${target.kind}`,
            path.join(EVAL_ROOT, target.guide),
            ...files.map(function line(file) {
              return `  ${file}`;
            }),
            "",
            "Next: promptmarket verify run",
            "",
          ].join("\n"),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  verify
    .command("run")
    .description("Run Promptfoo eval for suites under .promptmarket/evals")
    .argument("[dir]", "Project directory", ".")
    .action(async function verifyRunAction(dir: string) {
      await delegatePromptfoo(dir, "eval");
    });

  verify
    .command("changed")
    .description("Run Promptfoo only for features affected since a base ref")
    .option("--base <ref>", "Three-dot base, such as origin/main")
    .option("--project <dir>", "Project directory", ".")
    .option("--json", "Print deterministic JSON to stdout")
    .action(async function verifyChangedAction(options: {
      base?: string;
      project: string;
      json?: boolean;
    }) {
      try {
        if (!options.base) {
          throw new Error("Pass --base, for example origin/main.");
        }
        const contracts = await loadContracts(options.project);
        const changed = await changedFilesSince(
          options.project,
          options.base,
          deps.git,
        );
        const dependencies = await dependencyChangesSince(
          options.project,
          options.base,
          changed,
          deps.git,
        );
        const impact = assessChangeImpact(contracts, changed, {}, { dependencyChanges: dependencies });
        const suites = impact.features.filter(function hit(feature) {
          return feature.status === "impacted" && feature.suite;
        });
        if (options.json) {
          io.stdout(json({
            ok: true,
            suites: suites.map(function name(feature) {
              return feature.suite;
            }),
          }));
        } else if (suites.length === 0) {
          io.stdout("No impacted Promptfoo suites.\n");
          return;
        } else {
          io.stdout(
            [
              "Promptfoo",
              ...suites.map(function line(feature) {
                return `.promptmarket/evals/${feature.suite}`;
              }),
              "",
            ].join("\n"),
          );
        }
        const runner = deps.command ?? runInherited;
        for (const feature of suites) {
          const code = await runner(
            "npx",
            [...PROMPTFOO_EVAL],
            path.join(options.project, EVAL_ROOT, feature.suite ?? ""),
          );
          if (code !== 0) {
            state.exitCode = code;
            return;
          }
        }
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  verify
    .command("ci")
    .description("Scaffold a Promptfoo GitHub Action that gates pull requests")
    .option("--github", "Write .github/workflows/promptmarket-evals.yml")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--project <dir>", "Project directory", ".")
    .action(async function verifyCiAction(options: {
      github?: boolean;
      json?: boolean;
      project: string;
    }) {
      try {
        if (!options.github) {
          throw new Error("Pass --github to scaffold the Promptfoo pull request workflow.");
        }
        const destination = path.join(options.project, EVAL_WORKFLOW);
        try {
          await access(destination);
          throw new Error(
            `${EVAL_WORKFLOW} already exists. Promptfoo owns that workflow.`,
          );
        } catch (error) {
          if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
          }
        }
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, githubEvalWorkflow(), { flag: "wx" });
        const payload = {
          ok: true,
          file: EVAL_WORKFLOW,
          action: "promptfoo/promptfoo-action@v1",
          node: "24",
          secrets: ["GITHUB_TOKEN", "OPENAI_API_KEY"],
          workingDirectory: `${EVAL_ROOT}/<suite>`,
        };
        if (options.json) {
          io.stdout(json(payload));
          return;
        }
        io.stdout(
          [
            "CI Promptfoo",
            EVAL_WORKFLOW,
            "Node 24",
            "working directory .promptmarket/evals/<suite>",
            "secrets: GITHUB_TOKEN, OPENAI_API_KEY",
            "",
            "Promptfoo runs the suites, posts the pull request comment, and fails the job when an assertion fails.",
            "",
          ].join("\n"),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  verify
    .command("sync")
    .description("Copy curated Langfuse dataset items into a Promptfoo regression file")
    .argument("<provider>", "Observability provider")
    .option("--feature <id>", "Feature contract id")
    .option("--dataset <name>", "Langfuse dataset name")
    .option("--project <dir>", "Project directory", ".")
    .option("--json", "Print deterministic JSON to stdout")
    .action(async function verifySyncAction(
      provider: string,
      options: {
        feature?: string;
        dataset?: string;
        project: string;
        json?: boolean;
      },
    ) {
      try {
        if (provider !== "langfuse") {
          throw new Error("Langfuse is the only dataset source PromptMarket syncs.");
        }
        if (!options.feature || !options.dataset) {
          throw new Error(
            "Usage: promptmarket verify sync langfuse --feature <id> --dataset <name>",
          );
        }
        const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
        const secretKey = process.env.LANGFUSE_SECRET_KEY;
        if (!publicKey || !secretKey) {
          throw new Error(
            "Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY. Sync reads curated dataset items and does not read raw traces.",
          );
        }
        const loaded = await readFeatureContracts(options.project);
        const match = loaded.find(function same(item) {
          return "contract" in item && item.contract.id === options.feature;
        });
        if (!match || !("contract" in match)) {
          throw new Error(`No feature contract named ${options.feature}.`);
        }
        const items = await listDatasetItems(options.dataset, {
          publicKey,
          secretKey,
          baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
          fetch: deps.langfuseFetch ?? fetch,
        });
        const translated = productionCases(items);
        if (translated.cases.length === 0) {
          throw new Error(
            "No dataset items had an expected output. PromptMarket does not turn a raw production response into the expected answer.",
          );
        }
        const suiteDir = path.dirname(path.join(options.project, match.contract.eval?.suite ?? path.join(EVAL_ROOT, options.feature, "promptfooconfig.yaml")));
        await mkdir(suiteDir, { recursive: true });
        const relative = path.join(path.relative(options.project, suiteDir), "production-cases.yaml");
        await writeFile(path.join(suiteDir, "production-cases.yaml"), productionCasesYaml(translated.cases), "utf8");
        const configPath = path.join(suiteDir, "promptfooconfig.yaml");
        try {
          const config = await readFile(configPath, "utf8");
          await writeFile(configPath, includeProductionCases(config), "utf8");
        } catch (error) {
          if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
            throw error;
          }
        }
        const payload = {
          ok: true,
          feature: options.feature,
          dataset: options.dataset,
          file: relative,
          cases: translated.cases.length,
          skipped: translated.skipped,
        };
        if (options.json) {
          io.stdout(json(payload));
          return;
        }
        io.stdout(
          [
            `Wrote ${relative}`,
            `${translated.cases.length} curated cases`,
            translated.skipped > 0 ? `${translated.skipped} skipped without an expected output` : "",
            "",
          ].filter(function present(line) {
            return line.length > 0;
          }).join("\n") + "\n",
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  verify
    .command("view")
    .description("Open the Promptfoo results viewer")
    .argument("[dir]", "Project directory", ".")
    .action(async function verifyViewAction(dir: string) {
      await delegatePromptfoo(dir, "view");
    });

  async function delegatePromptfoo(dir: string, mode: "eval" | "view") {
    try {
      const runner = deps.command ?? runInherited;
      if (mode === "view") {
        state.exitCode = await runner("npx", [...PROMPTFOO_VIEW], dir);
        return;
      }
      const root = path.join(dir, EVAL_ROOT);
      const guides = await readdir(root).catch(function missing() {
        return [] as string[];
      });
      if (guides.length === 0) {
        throw new Error("No Promptfoo suite found. Run promptmarket verify init first.");
      }
      for (const guide of guides) {
        const code = await runner("npx", [...PROMPTFOO_EVAL], path.join(root, guide));
        if (code !== 0) {
          state.exitCode = code;
          return;
        }
      }
    } catch (error) {
      writeFailure(io, state, false, error);
    }
  }

  program
    .command("observe")
    .description("Explain production tracing for a plan. Does not edit application code.")
    .argument("<query>", "Feature to observe, or setup")
    .argument("[provider]", "Provider when the first argument is setup")
    .argument("[feature]", "Feature for setup. Defaults to add RAG")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--project <dir>", "Project directory")
    .option("--write", "Refused. Setup does not edit application code.")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function observeAction(
      query: string,
      provider: string | undefined,
      feature: string | undefined,
      options: {
        json?: boolean;
        project?: string;
        write?: boolean;
        offline?: boolean;
        refresh?: boolean;
        contentApi?: string;
        content?: string;
      },
    ) {
      try {
        if (query === "setup") {
          const named = provider ?? "langfuse";
          if (options.write) {
            throw new Error(
              "observe setup does not edit application code. Omit --write.",
            );
          }
          if (named !== "langfuse") {
            throw new Error(
              "Langfuse is the only observability provider PromptMarket names.",
            );
          }
          const projectDir = options.project ?? ".";
          const { catalog } = await openContent(options, deps);
          const project = detectProject(projectDir);
          const plan = buildPlan(catalog, {
            query: feature ?? "add RAG",
            project,
          });
          const telemetry = detectTelemetry(projectDir, project);
          const text = formatLangfuseSetup(plan, project, telemetry);
          if (options.json) {
            io.stdout(
              json({
                ok: true,
                provider: named,
                wrote: false,
                packages: [
                  "@langfuse/client",
                  "@langfuse/vercel-ai-sdk",
                  "@langfuse/tracing",
                  "@langfuse/otel",
                  "@opentelemetry/sdk-node",
                ],
                environment: [
                  "LANGFUSE_SECRET_KEY",
                  "LANGFUSE_PUBLIC_KEY",
                  "LANGFUSE_BASE_URL",
                ],
                telemetry,
                observabilityTargets: plan.observabilityTargets,
                text,
              }),
            );
            return;
          }
          io.stdout(text);
          return;
        }
        if (provider) {
          throw new Error('Usage: promptmarket observe "<feature>" --project .');
        }
        const { catalog } = await openContent(options, deps);
        const project = options.project
          ? detectProject(options.project)
          : undefined;
        const plan = buildPlan(catalog, { query, project });
        if (options.json) {
          io.stdout(
            json({
              ok: true,
              goal: plan.goal,
              observabilityTargets: plan.observabilityTargets,
            }),
          );
          return;
        }
        io.stdout(formatObservation(plan));
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

  const feature = program
    .command("feature")
    .description("Version-controlled contracts for AI features in this repository");

  feature
    .command("init")
    .description("Create a feature contract and Promptfoo suite from a plan")
    .argument("<query>", "Feature to record, in plain language")
    .option("--id <id>", "Contract id. Defaults to a slug of the goal")
    .option("--path <glob>", "Implementation path this feature owns", collectPath, [])
    .option("--project <dir>", "Project directory", ".")
    .option("--write", "Write the contract and eval suite")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function featureInitAction(
      query: string,
      options: {
        id?: string;
        path?: string[];
        project: string;
        write?: boolean;
        json?: boolean;
        offline?: boolean;
        refresh?: boolean;
        contentApi?: string;
        content?: string;
      },
    ) {
      try {
        const { catalog, version } = await openContent(options, deps);
        const project = detectProject(options.project);
        const plan = buildPlan(catalog, { query, project });
        if (!plan.guide) {
          throw new Error("No catalog guide matched this feature. A contract needs a guide identity.");
        }
        const contract = contractFromPlan(
          plan,
          version,
          options.id ?? featureIdFromGoal(query),
          options.path,
        );
        const destination = path.join(FEATURE_ROOT, `${contract.id}.yaml`);
        if (!options.write) {
          if (options.json) {
            io.stdout(json({ ok: true, wrote: false, contract }));
            return;
          }
          io.stdout(
            [
              destination,
              contract.eval?.suite ?? "",
              "",
              "Dry run. Pass --write to create the contract.",
              "",
            ].filter(function present(line) {
              return line.length > 0;
            }).join("\n") + "\n",
          );
          return;
        }
        const contractPath = path.join(options.project, destination);
        try {
          await access(contractPath);
          throw new Error(`${destination} already exists.`);
        } catch (error) {
          if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
          }
        }
        await writeFeatureContract(options.project, contract);
        let files: string[] = [];
        if (plan.evalTargets[0] && contract.eval) {
          files = await writeEvalSuite(options.project, plan.evalTargets[0], {
            directoryName: contract.id,
            tracing: contract.observability?.provider === "langfuse",
          });
        }
        if (options.json) {
          io.stdout(json({ ok: true, wrote: true, contract, files }));
          return;
        }
        io.stdout(
          [
            destination,
            ...(contract.eval ? [path.dirname(contract.eval.suite)] : []),
            ...files.map(function line(file) {
              return `  ${file}`;
            }),
            "",
          ].join("\n"),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  async function loadAssessments(
    root: string,
    flags: ContentFlags,
  ): Promise<{ assessments: FeatureAssessment[]; failed: boolean }> {
    const loaded = await readFeatureContracts(root);
    const malformed = loaded.filter(function bad(item) {
      return "error" in item;
    });
    if (malformed.length > 0) {
      throw new Error(malformed.map(function message(item) {
        return "error" in item ? item.error : "Malformed feature contract";
      }).join("\n"));
    }
    const { catalog } = await openContent(flags, deps);
    const project = detectProject(root);
    const assessments: FeatureAssessment[] = [];
    for (const item of loaded) {
      if (!("contract" in item)) {
        continue;
      }
      const evidence = await featureEvidence(root, item.contract, project);
      assessments.push(assessFeature(item.contract, catalog, project, evidence));
    }
    return {
      assessments,
      failed: assessments.some(function broken(item) {
        return item.errors.length > 0;
      }),
    };
  }

  feature
    .command("status")
    .description("Report each feature contract against the catalog and project")
    .argument("[id]", "One feature id")
    .option("--all", "Included for parity with feature check")
    .option("--project <dir>", "Project directory", ".")
    .option("--github-summary", "Print a GitHub Actions job summary")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function featureStatusAction(
      id: string | undefined,
      options: {
        all?: boolean;
        project: string;
        githubSummary?: boolean;
        json?: boolean;
        offline?: boolean;
        refresh?: boolean;
        contentApi?: string;
        content?: string;
      },
    ) {
      try {
        const { assessments } = await loadAssessments(options.project, options);
        const selected = id
          ? assessments.filter(function same(item) {
              return item.id === id;
            })
          : assessments;
        if (id && selected.length === 0) {
          throw new Error(`No feature contract named ${id}.`);
        }
        if (options.json) {
          io.stdout(json({ ok: true, features: selected }));
          return;
        }
        io.stdout(
          options.githubSummary
            ? formatFeatureSummary(selected)
            : formatFeatureStatus(selected),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  feature
    .command("check")
    .description("Exit nonzero only for objective feature-contract failures")
    .option("--all", "Check every contract in .promptmarket/features")
    .option("--project <dir>", "Project directory", ".")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function featureCheckAction(options: {
      all?: boolean;
      project: string;
      json?: boolean;
      offline?: boolean;
      refresh?: boolean;
      contentApi?: string;
      content?: string;
    }) {
      try {
        if (!options.all) {
          throw new Error("Pass --all to check every feature contract.");
        }
        const { assessments, failed } = await loadAssessments(options.project, options);
        if (failed) {
          state.exitCode = 1;
        }
        if (options.json) {
          io.stdout(json({ ok: !failed, features: assessments }));
          return;
        }
        io.stdout(formatFeatureStatus(assessments));
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  feature
    .command("refresh")
    .description("Compare a feature contract with the latest catalog plan")
    .argument("<id>", "Feature id")
    .option("--write", "Update catalog metadata when the guide identity is unchanged")
    .option("--project <dir>", "Project directory", ".")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--offline", "Use the bundled content snapshot")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function featureRefreshAction(
      id: string,
      options: {
        write?: boolean;
        project: string;
        json?: boolean;
        offline?: boolean;
        contentApi?: string;
        content?: string;
      },
    ) {
      try {
        const loaded = await readFeatureContracts(options.project);
        const match = loaded.find(function same(item) {
          return "contract" in item && item.contract.id === id;
        });
        if (!match || !("contract" in match)) {
          throw new Error(`No feature contract named ${id}.`);
        }
        const { catalog, version } = await openContent(options, deps);
        const project = detectProject(options.project);
        const plan = buildPlan(catalog, { query: match.contract.goal, project });
        const diff = refreshFeature(match.contract, plan, version);
        const written = Boolean(options.write && diff.wrote.length > 0);
        if (written) {
          await writeFeatureContract(options.project, diff.next);
        }
        if (options.json) {
          io.stdout(json({ ok: true, wrote: written, fields: diff.wrote, held: diff.held }));
          return;
        }
        io.stdout(formatFeatureRefresh(diff, written));
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  feature
    .command("attach")
    .description("Add implementation paths to an existing feature contract")
    .argument("<id>", "Feature id")
    .option("--path <glob>", "Implementation path this feature owns", collectPath, [])
    .option("--write", "Update the contract")
    .option("--project <dir>", "Project directory", ".")
    .option("--json", "Print deterministic JSON to stdout")
    .action(async function featureAttachAction(
      id: string,
      options: { path?: string[]; write?: boolean; project: string; json?: boolean },
    ) {
      try {
        const paths = options.path ?? [];
        if (paths.length === 0) {
          throw new Error("Pass at least one --path glob.");
        }
        const contracts = await loadContracts(options.project);
        const current = contracts.find(function same(contract) {
          return contract.id === id;
        });
        if (!current) {
          throw new Error(`No feature contract named ${id}.`);
        }
        const next = attachPaths(current, paths);
        if (options.write) {
          await writeFeatureContract(options.project, next);
        }
        if (options.json) {
          io.stdout(json({ ok: true, wrote: Boolean(options.write), contract: next }));
          return;
        }
        io.stdout(
          [
            path.join(FEATURE_ROOT, `${next.id}.yaml`),
            ...(next.implementation?.paths ?? []).map(function line(glob) {
              return `  ${glob}`;
            }),
            "",
            options.write ? "Updated." : "Dry run. Pass --write to update the contract.",
            "",
          ].join("\n"),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  feature
    .command("adopt")
    .description("Record an existing AI feature without editing its implementation")
    .requiredOption("--goal <text>", "What the existing feature does")
    .option("--id <id>", "Contract id. Defaults to a slug of the goal")
    .option("--path <glob>", "Implementation path this feature owns", collectPath, [])
    .option("--write", "Write the contract and eval starter")
    .option("--project <dir>", "Project directory", ".")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function featureAdoptAction(options: {
      goal: string;
      id?: string;
      path?: string[];
      write?: boolean;
      project: string;
      json?: boolean;
      offline?: boolean;
      refresh?: boolean;
      contentApi?: string;
      content?: string;
    }) {
      try {
        const paths = options.path ?? [];
        if (paths.length === 0) {
          throw new Error("Pass at least one --path glob. Adopt does not infer ownership.");
        }
        const { catalog, version } = await openContent(options, deps);
        const project = detectProject(options.project);
        const plan = buildPlan(catalog, { query: options.goal, project });
        if (!plan.guide) {
          throw new Error("No catalog guide matched this feature. A contract needs a guide identity.");
        }
        const contract = contractFromPlan(
          plan,
          version,
          options.id ?? featureIdFromGoal(options.goal),
          paths,
        );
        const destination = path.join(FEATURE_ROOT, `${contract.id}.yaml`);
        if (!options.write) {
          if (options.json) {
            io.stdout(json({ ok: true, wrote: false, contract, touchedImplementation: false }));
            return;
          }
          io.stdout(
            [
              destination,
              ...(contract.implementation?.paths ?? []),
              "",
              "Dry run. Pass --write to record the contract. Implementation files stay untouched.",
              "",
            ].join("\n"),
          );
          return;
        }
        try {
          await access(path.join(options.project, destination));
          throw new Error(`${destination} already exists.`);
        } catch (error) {
          if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
          }
        }
        await writeFeatureContract(options.project, contract);
        let files: string[] = [];
        if (plan.evalTargets[0] && contract.eval) {
          files = await writeEvalSuite(options.project, plan.evalTargets[0], {
            directoryName: contract.id,
            tracing: contract.observability?.provider === "langfuse",
          });
        }
        if (options.json) {
          io.stdout(json({
            ok: true,
            wrote: true,
            touchedImplementation: false,
            contract,
            files,
          }));
          return;
        }
        io.stdout(
          [
            destination,
            ...(contract.implementation?.paths ?? []).map(function line(glob) {
              return `  ${glob}`;
            }),
            ...(contract.eval ? [path.dirname(contract.eval.suite)] : []),
            ...files.map(function line(file) {
              return `  ${file}`;
            }),
            "",
            "Implementation files were not modified.",
            "",
          ].join("\n"),
        );
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  feature
    .command("review")
    .description("Review a change against the AI feature contracts it touches")
    .option("--base <ref>", "Three-dot base, such as origin/main")
    .option("--project <dir>", "Project directory", ".")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function featureReviewAction(options: {
      base?: string;
      project: string;
      json?: boolean;
      offline?: boolean;
      refresh?: boolean;
      contentApi?: string;
      content?: string;
    }) {
      try {
        if (!options.base) {
          throw new Error("Pass --base, for example origin/main.");
        }
        const contracts = await loadContracts(options.project);
        const changed = await changedFilesSince(options.project, options.base, deps.git);
        const dependencies = await dependencyChangesSince(
          options.project,
          options.base,
          changed,
          deps.git,
        );
        const { catalog } = await openContent(options, deps);
        const impact = assessChangeImpact(contracts, changed, {}, { dependencyChanges: dependencies });
        const reviews = impact.features.flatMap(function review(feature) {
          if (feature.status !== "impacted") {
            return [];
          }
          const contract = contracts.find(function same(item) {
            return item.id === feature.id;
          });
          if (!contract) {
            return [];
          }
          return [reviewFeatureChange(
            contract,
            changed,
            guideContextFor(catalog, contract),
            dependencies,
          )];
        });
        if (options.json) {
          io.stdout(json({ ok: true, reviews }));
          return;
        }
        io.stdout(formatFeatureReviews(reviews));
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("impacted")
    .description("List AI features affected since a base ref")
    .requiredOption("--base <ref>", "Three-dot base, such as origin/main")
    .option("--project <dir>", "Project directory", ".")
    .option("--github-summary", "Print a GitHub Actions job summary")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--offline", "Use the bundled content snapshot")
    .option("--refresh", "Bypass the content cache freshness window")
    .option("--content-api <url>", "Content API base URL")
    .option("--content <dir>", "Read lessons, prompts, and guides from a directory")
    .action(async function impactedAction(options: {
      base: string;
      project: string;
      githubSummary?: boolean;
      json?: boolean;
      offline?: boolean;
      refresh?: boolean;
      contentApi?: string;
      content?: string;
    }) {
      try {
        const contracts = await loadContracts(options.project);
        const changed = await changedFilesSince(options.project, options.base, deps.git);
        const dependencies = await dependencyChangesSince(
          options.project,
          options.base,
          changed,
          deps.git,
        );
        const { catalog } = await openContent(options, deps);
        const guides: Record<string, FeatureGuideContext> = {};
        for (const contract of contracts) {
          guides[contract.id] = guideContextFor(catalog, contract);
        }
        const impact = assessChangeImpact(contracts, changed, guides, {
          dependencyChanges: dependencies,
        });
        if (options.json) {
          io.stdout(json({ ok: true, base: options.base, comparison: "three-dot", ...impact }));
          return;
        }
        io.stdout(options.githubSummary ? formatChangeSummary(impact) : formatChangeImpact(impact));
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
