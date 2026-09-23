import { Command, CommanderError } from "commander";
import {
  ContentNotFoundError,
  loadContentCatalog,
  type ContentCatalog,
  type PromptDocument,
} from "@promptmarket/content";
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

const SITE_ORIGIN = "https://promptmarket.sh";

function contentCatalog(contentDir?: string): ContentCatalog {
  return loadContentCatalog(contentDir ? { contentDir } : undefined);
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
      "Search prompts and lessons, read guides, or install PromptMarket skills",
    )
    .version("0.3.0")
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
    .description("Search prompts, then skills, by name, description, and tags")
    .argument("<query>", "Search query")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--recipes <dir>", "Read recipes from a local directory")
    .option("--registry <url>", "Registry API base URL")
    .option("--content <dir>", "Read lessons and prompts from a directory")
    .action(async function searchAction(
      query: string,
      options: {
        json?: boolean;
        recipes?: string;
        registry?: string;
        content?: string;
      },
    ) {
      try {
        const prompts = contentCatalog(options.content).searchPrompts(query);
        const recipes = await createRegistry(options).search(query);
        const summaries = recipes.map(summarizeRecipe);
        if (options.json) {
          io.stdout(
            json({
              ok: true,
              query,
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
        if (prompts.length === 0 && summaries.length === 0) {
          io.stdout("No prompts or skills matched.\n");
          return;
        }
        if (prompts.length > 0) {
          io.stdout("Prompts\n");
          for (const prompt of prompts) {
            io.stdout(`${prompt.name}\n${prompt.description}\n`);
          }
        }
        if (summaries.length > 0) {
          io.stdout("Skills\n");
          for (const recipe of summaries) {
            io.stdout(
              `${recipe.name}\t${recipe.version}\n${recipe.description}\n`,
            );
          }
        }
      } catch (error) {
        writeFailure(io, state, Boolean(options.json), error);
      }
    });

  program
    .command("info")
    .description("Inspect one recipe, optionally at an exact version")
    .argument("<recipe>", "Recipe name or name@version")
    .option("--json", "Print deterministic JSON to stdout")
    .option("--recipes <dir>", "Read recipes from a local directory")
    .option("--registry <url>", "Registry API base URL")
    .action(async function infoAction(
      name: string,
      options: { json?: boolean; recipes?: string; registry?: string },
    ) {
      try {
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
    .action(async function showAction(
      name: string,
      options: {
        json?: boolean;
        recipes?: string;
        registry?: string;
        content?: string;
      },
    ) {
      try {
        const catalog = contentCatalog(options.content);
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
    .action(function learnAction(
      slug: string,
      options: { json?: boolean; content?: string },
    ) {
      try {
        const topic = contentCatalog(options.content).getTopic(slug);
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
    .action(function guidesAction(options: {
      json?: boolean;
      content?: string;
    }) {
      try {
        const guides = contentCatalog(options.content).guides;
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
    .action(function guideAction(
      slug: string,
      options: { json?: boolean; content?: string },
    ) {
      try {
        const guide = contentCatalog(options.content).getGuide(slug);
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
