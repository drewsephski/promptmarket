import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import {
  LockfileSchema,
  compareSemver,
  parseRecipeRef,
  type Lockfile,
  type LockfileEntry,
  type RecipeSource,
} from "@promptmarket/schema";
import { digestFiles } from "./digest.js";
import { IntegrityError } from "./errors.js";
import { FileRegistry } from "./file-registry.js";
import { normalizeRecipeFiles, writeRecipeFiles } from "./recipe-files.js";
import { RemoteRegistry } from "./remote-registry.js";
import type {
  InstallOptions,
  InstalledRecipe,
  RecipeFile,
  Registry,
} from "./types.js";

function lockfilePath(projectDir: string): string {
  return path.join(projectDir, "promptmarket.lock");
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
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

function lockfileSource(source: RecipeSource): RecipeSource {
  if (source.type === "file") {
    return { type: "file" };
  }
  return { type: "registry", url: source.url };
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
      source: lockfileSource(entry.source),
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

export type LockfileInstallOptions = {
  projectDir?: string;
  recipesDir?: string;
  fetchImpl?: typeof fetch;
};

export type OutdatedRecipe = {
  name: string;
  version: string;
  latest: string;
};

export function registryForSource(
  source: RecipeSource,
  options?: { recipesDir?: string; fetchImpl?: typeof fetch },
): Registry {
  if (source.type === "file") {
    return new FileRegistry(
      options?.recipesDir ? { recipesDir: options.recipesDir } : undefined,
    );
  }
  return new RemoteRegistry(source.url, options?.fetchImpl ?? fetch);
}

function assertExactPackage(
  requestedName: string,
  requestedVersion: string | undefined,
  fetchedName: string,
  fetchedVersion: string,
): void {
  const requested = requestedVersion
    ? `${requestedName}@${requestedVersion}`
    : requestedName;
  if (fetchedName !== requestedName) {
    throw new Error(`Registry returned "${fetchedName}" for "${requested}"`);
  }
  if (requestedVersion && fetchedVersion !== requestedVersion) {
    throw new Error(
      `Registry returned "${fetchedName}@${fetchedVersion}" for "${requested}"`,
    );
  }
}

export async function installRecipe(
  reference: string,
  options: InstallOptions,
): Promise<InstalledRecipe> {
  const ref = parseRecipeRef(reference);
  const projectDir = path.resolve(options.projectDir ?? process.cwd());
  const registry: Registry = options.registry;
  const lockfile = await readLockfile(projectDir);
  const fetched = await registry.fetchPackage(ref.name, ref.version);
  assertExactPackage(
    ref.name,
    ref.version,
    fetched.recipe.manifest.name,
    fetched.recipe.manifest.version,
  );
  const files = normalizeRecipeFiles(fetched.files);
  const integrity = digestFiles(files);
  if (integrity !== fetched.integrity) {
    throw new IntegrityError(fetched.integrity, integrity);
  }

  const destination = path.join(
    projectDir,
    ".agents",
    "skills",
    fetched.recipe.manifest.name,
  );
  await writeRecipeFiles(destination, files);

  const entry: LockfileEntry = {
    name: fetched.recipe.manifest.name,
    version: fetched.recipe.manifest.version,
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

export async function installFromLockfile(
  options?: LockfileInstallOptions,
): Promise<InstalledRecipe[]> {
  const projectDir = path.resolve(options?.projectDir ?? process.cwd());
  const lockfile = await readLockfile(projectDir);
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

  const planned: Array<{
    entry: LockfileEntry;
    files: RecipeFile[];
    destination: string;
  }> = [];

  for (const name of names) {
    const entry = lockfile.recipes[name];
    if (!entry) {
      continue;
    }
    const registry = registryForSource(entry.source, options);
    const fetched = await registry.fetchPackage(entry.name, entry.version);
    assertExactPackage(
      entry.name,
      entry.version,
      fetched.recipe.manifest.name,
      fetched.recipe.manifest.version,
    );
    const files = normalizeRecipeFiles(fetched.files);
    const integrity = digestFiles(files);
    if (integrity !== entry.integrity || integrity !== fetched.integrity) {
      throw new IntegrityError(entry.integrity, integrity);
    }
    planned.push({
      entry,
      files,
      destination: path.join(projectDir, ".agents", "skills", entry.name),
    });
  }

  const installed: InstalledRecipe[] = [];
  for (const item of planned) {
    await writeRecipeFiles(item.destination, item.files);
    installed.push({
      name: item.entry.name,
      version: item.entry.version,
      source: lockfileSource(item.entry.source),
      integrity: item.entry.integrity,
      destination: item.destination,
    });
  }
  return installed;
}

export async function findOutdatedRecipes(
  options?: LockfileInstallOptions,
): Promise<OutdatedRecipe[]> {
  const projectDir = path.resolve(options?.projectDir ?? process.cwd());
  const lockfile = await readLockfile(projectDir);
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
  const outdated: OutdatedRecipe[] = [];
  for (const name of names) {
    const entry = lockfile.recipes[name];
    if (!entry) {
      continue;
    }
    const latest = await registryForSource(entry.source, options).get(
      entry.name,
    );
    if (compareSemver(entry.version, latest.manifest.version) < 0) {
      outdated.push({
        name: entry.name,
        version: entry.version,
        latest: latest.manifest.version,
      });
    }
  }
  return outdated;
}
