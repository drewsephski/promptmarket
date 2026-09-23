import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import {
  LockfileSchema,
  type Lockfile,
  type LockfileEntry,
} from "@promptmarket/schema";
import { FileRegistry } from "./file-registry.js";
import type { InstallOptions, InstalledRecipe } from "./types.js";

function lockfilePath(projectDir: string): string {
  return path.join(projectDir, "promptmarket.lock");
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function collectFiles(directory: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    const sorted = [...entries].sort(function byName(left, right) {
      if (left.name < right.name) {
        return -1;
      }
      if (left.name > right.name) {
        return 1;
      }
      return 0;
    });

    for (const entry of sorted) {
      if (entry.name === ".DS_Store") {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(directory);
  return files;
}

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export async function digestRecipe(recipePath: string): Promise<string> {
  const files = await collectFiles(recipePath);
  const hash = createHash("sha256");
  for (const file of files) {
    const relativePath = toPosix(path.relative(recipePath, file));
    const contents = await readFile(file);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  }
  return `sha256-${hash.digest("base64")}`;
}

async function readLockfile(projectDir: string): Promise<Lockfile> {
  const filePath = lockfilePath(projectDir);
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return { lockfileVersion: 1, recipes: {} };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`Invalid promptmarket.lock: ${message}`);
  }

  const result = LockfileSchema.safeParse(parsed);
  if (!result.success) {
    const message = result.error.issues
      .map(function formatIssue(issue) {
        return issue.message;
      })
      .join("; ");
    throw new Error(`Invalid promptmarket.lock: ${message}`);
  }

  for (const [name, entry] of Object.entries(result.data.recipes)) {
    if (entry.name !== name) {
      throw new Error(
        `Invalid promptmarket.lock: recipe key "${name}" does not match entry name "${entry.name}"`,
      );
    }
  }

  return result.data;
}

function serializeLockfile(lockfile: Lockfile): string {
  const names = Object.keys(lockfile.recipes).sort(
    function byName(left, right) {
      if (left < right) {
        return -1;
      }
      if (left > right) {
        return 1;
      }
      return 0;
    },
  );
  const recipes: Lockfile["recipes"] = {};
  for (const name of names) {
    const entry = lockfile.recipes[name];
    if (!entry) {
      continue;
    }
    recipes[name] = {
      name: entry.name,
      version: entry.version,
      source: entry.source,
      integrity: entry.integrity,
    };
  }

  return `${JSON.stringify({ lockfileVersion: 1 as const, recipes }, null, 2)}\n`;
}

async function writeLockfile(
  projectDir: string,
  lockfile: Lockfile,
): Promise<void> {
  await mkdir(projectDir, { recursive: true });
  const target = lockfilePath(projectDir);
  const temporary = path.join(projectDir, "promptmarket.lock.tmp");
  const handle = await open(temporary, "w");
  try {
    await handle.writeFile(serializeLockfile(lockfile));
    await handle.sync();
  } catch (error) {
    await handle.close();
    await rm(temporary, { force: true });
    throw error;
  }
  await handle.close();
  await rename(temporary, target);
}

async function copyRecipe(source: string, destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const files = await collectFiles(source);
  for (const file of files) {
    const relativePath = path.relative(source, file);
    const target = path.join(destination, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(file, target);
  }
}

export async function installRecipe(
  name: string,
  options?: InstallOptions,
): Promise<InstalledRecipe> {
  const projectDir = path.resolve(options?.projectDir ?? process.cwd());
  const registry = new FileRegistry(options);
  const lockfile = await readLockfile(projectDir);
  const recipe = await registry.get(name);
  const integrity = await digestRecipe(recipe.path);
  const destination = path.join(
    projectDir,
    ".agents",
    "skills",
    recipe.manifest.name,
  );
  await copyRecipe(recipe.path, destination);

  const entry: LockfileEntry = {
    name: recipe.manifest.name,
    version: recipe.manifest.version,
    source: registry.source,
    integrity,
  };
  lockfile.recipes[entry.name] = entry;
  await writeLockfile(projectDir, lockfile);

  return {
    name: entry.name,
    version: entry.version,
    source: entry.source,
    integrity: entry.integrity,
    destination,
  };
}
