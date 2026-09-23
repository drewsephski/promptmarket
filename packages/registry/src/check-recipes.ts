import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkRecipeRepository } from "./immutability.js";

type Args = {
  base?: string;
  recipes?: string;
  json: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--base") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --base");
      }
      args.base = value;
      index += 1;
      continue;
    }
    if (token?.startsWith("--base=")) {
      args.base = token.slice("--base=".length);
      continue;
    }
    if (token === "--recipes") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --recipes");
      }
      args.recipes = value;
      index += 1;
    }
  }
  return args;
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const repoDir = process.cwd();
  const result = await checkRecipeRepository({
    repoDir,
    recipesDir: args.recipes ? path.resolve(args.recipes) : undefined,
    base: args.base,
  });
  if (result.ok) {
    if (args.json) {
      process.stdout.write(`${JSON.stringify({ ok: true }, null, 2)}\n`);
    } else {
      process.stdout.write("Recipe registry is valid.\n");
    }
    return 0;
  }

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, issues: result.issues }, null, 2)}\n`,
    );
  } else {
    for (const issue of result.issues) {
      process.stderr.write(`${issue.code}\t${issue.path}\t${issue.message}\n`);
    }
  }
  return 1;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return pathToFileURL(path.resolve(entry)).href === import.meta.url;
}

if (isDirectRun()) {
  main(process.argv.slice(2))
    .then(function finish(code) {
      process.exitCode = code;
    })
    .catch(function fail(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
