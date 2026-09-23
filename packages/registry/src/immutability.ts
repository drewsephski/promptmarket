import { readdir } from "node:fs/promises";
import path from "node:path";
import { SemVerSchema, SkillNameSchema } from "@promptmarket/schema";
import { createProcessRunner, type ProcessRunner } from "./process-runner.js";
import { readRecipeFiles } from "./recipe-files.js";
import type { RecipeFile } from "./types.js";
import { scanRecipes } from "./file-registry.js";

export type RecipeVersionFiles = {
  name: string;
  version: string;
  files: RecipeFile[];
};

export type ImmutabilityIssue = {
  code: "version_modified" | "version_deleted" | "version_renamed";
  name: string;
  version: string;
  message: string;
  paths: string[];
};

export type CheckIssue = {
  code: string;
  path: string;
  message: string;
};

function versionKey(name: string, version: string): string {
  return `${name}\0${version}`;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.equals(b);
}

function changedPaths(base: RecipeFile[], head: RecipeFile[]): string[] {
  const baseFiles = new Map(
    base.map(function entry(file) {
      return [file.path, file.contents] as const;
    }),
  );
  const headFiles = new Map(
    head.map(function entry(file) {
      return [file.path, file.contents] as const;
    }),
  );
  const paths = new Set<string>([...baseFiles.keys(), ...headFiles.keys()]);
  const changed: string[] = [];
  for (const filePath of [...paths].sort(function byPath(left, right) {
    if (left < right) {
      return -1;
    }
    if (left > right) {
      return 1;
    }
    return 0;
  })) {
    const before = baseFiles.get(filePath);
    const after = headFiles.get(filePath);
    if (!before || !after || !sameBytes(before, after)) {
      changed.push(filePath);
    }
  }
  return changed;
}

export function diffRecipeVersions(
  base: RecipeVersionFiles[],
  head: RecipeVersionFiles[],
): ImmutabilityIssue[] {
  const baseMap = new Map(
    base.map(function entry(item) {
      return [versionKey(item.name, item.version), item] as const;
    }),
  );
  const headMap = new Map(
    head.map(function entry(item) {
      return [versionKey(item.name, item.version), item] as const;
    }),
  );
  const issues: ImmutabilityIssue[] = [];

  for (const item of base) {
    const current = headMap.get(versionKey(item.name, item.version));
    if (!current) {
      const renamed = head.some(function added(candidate) {
        return (
          candidate.name === item.name &&
          !baseMap.has(versionKey(candidate.name, candidate.version))
        );
      });
      issues.push({
        code: renamed ? "version_renamed" : "version_deleted",
        name: item.name,
        version: item.version,
        paths: [],
        message: renamed
          ? `Published version ${item.name}@${item.version} was renamed. Add a new version without changing recipes/${item.name}/${item.version}.`
          : `Published version ${item.name}@${item.version} was deleted. Published versions are immutable.`,
      });
      continue;
    }

    const paths = changedPaths(item.files, current.files);
    if (paths.length > 0) {
      issues.push({
        code: "version_modified",
        name: item.name,
        version: item.version,
        paths,
        message: `Published version ${item.name}@${item.version} changed (${paths.join(", ")}). Published versions are immutable.`,
      });
    }
  }

  return issues;
}

async function listDirectories(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter(function isDirectory(entry) {
        return entry.isDirectory();
      })
      .map(function nameOf(entry) {
        return entry.name;
      })
      .sort(function byName(left, right) {
        if (left < right) {
          return -1;
        }
        if (left > right) {
          return 1;
        }
        return 0;
      });
  } catch {
    return [];
  }
}

export async function loadRecipeTree(recipesDir: string): Promise<{
  versions: RecipeVersionFiles[];
  unreadable: Array<{ name: string; version: string; message: string }>;
}> {
  const versions: RecipeVersionFiles[] = [];
  const unreadable: Array<{ name: string; version: string; message: string }> =
    [];
  const names = await listDirectories(recipesDir);
  for (const name of names) {
    if (!SkillNameSchema.safeParse(name).success) {
      continue;
    }
    const versionNames = await listDirectories(path.join(recipesDir, name));
    for (const version of versionNames) {
      if (!SemVerSchema.safeParse(version).success) {
        continue;
      }
      const versionPath = path.join(recipesDir, name, version);
      try {
        versions.push({
          name,
          version,
          files: await readRecipeFiles(versionPath),
        });
      } catch (error) {
        unreadable.push({
          name,
          version,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return { versions, unreadable };
}

function groupGitFiles(
  entries: Array<{ path: string; contents: Uint8Array }>,
): RecipeVersionFiles[] {
  const grouped = new Map<string, RecipeVersionFiles>();
  for (const entry of entries) {
    const match = /^recipes\/([^/]+)\/([^/]+)\/(.+)$/u.exec(entry.path);
    if (!match?.[1] || !match[2] || !match[3]) {
      continue;
    }
    if (match[3] === ".DS_Store" || match[3].endsWith("/.DS_Store")) {
      continue;
    }
    const key = versionKey(match[1], match[2]);
    const current = grouped.get(key) ?? {
      name: match[1],
      version: match[2],
      files: [],
    };
    current.files.push({ path: match[3], contents: entry.contents });
    grouped.set(key, current);
  }
  return [...grouped.values()].sort(function byIdentity(left, right) {
    const key = versionKey(left.name, left.version);
    const other = versionKey(right.name, right.version);
    if (key < other) {
      return -1;
    }
    if (key > other) {
      return 1;
    }
    return 0;
  });
}

export async function loadRecipeTreeFromGit(
  repoDir: string,
  revision: string,
  runner: ProcessRunner = createProcessRunner(),
): Promise<RecipeVersionFiles[]> {
  const listed = await runner.run(
    "git",
    ["ls-tree", "-r", "--name-only", revision, "--", "recipes"],
    { cwd: repoDir },
  );
  if (listed.code !== 0) {
    throw new Error(
      listed.stderr.trim() || `Could not list recipes at ${revision}`,
    );
  }
  const paths = listed.stdout
    .split("\n")
    .map(function trim(line) {
      return line.trim();
    })
    .filter(function nonEmpty(line) {
      return line.length > 0;
    });
  const entries: Array<{ path: string; contents: Uint8Array }> = [];
  for (const filePath of paths) {
    const blob = await runner.run(
      "git",
      ["cat-file", "blob", `${revision}:${filePath}`],
      { cwd: repoDir },
    );
    if (blob.code !== 0) {
      throw new Error(
        blob.stderr.trim() || `Could not read ${revision}:${filePath}`,
      );
    }
    entries.push({ path: filePath, contents: blob.stdoutBuffer });
  }
  return groupGitFiles(entries);
}

export async function checkRecipeRepository(options: {
  repoDir: string;
  recipesDir?: string;
  base?: string;
  runner?: ProcessRunner;
}): Promise<{ ok: true } | { ok: false; issues: CheckIssue[] }> {
  const recipesDir =
    options.recipesDir ?? path.join(options.repoDir, "recipes");
  const scan = await scanRecipes({ recipesDir });
  const issues: CheckIssue[] = [];
  for (const invalid of scan.invalid) {
    for (const error of invalid.errors) {
      issues.push({
        code: error.code,
        path: invalid.path,
        message: `${error.path}: ${error.message}`,
      });
    }
  }

  if (options.base) {
    const loaded = await loadRecipeTree(recipesDir);
    const baseTree = await loadRecipeTreeFromGit(
      options.repoDir,
      options.base,
      options.runner,
    );
    const unreadable = new Set(
      loaded.unreadable.map(function keyOf(item) {
        return `${item.name}\0${item.version}`;
      }),
    );
    for (const failure of loaded.unreadable) {
      const published = baseTree.some(function matches(item) {
        return item.name === failure.name && item.version === failure.version;
      });
      issues.push({
        code: published ? "version_modified" : "package_structure",
        path: `recipes/${failure.name}/${failure.version}`,
        message: published
          ? `Published version ${failure.name}@${failure.version} could not be read (${failure.message}).`
          : failure.message,
      });
    }
    const comparableBase = baseTree.filter(function readable(item) {
      return !unreadable.has(`${item.name}\0${item.version}`);
    });
    for (const issue of diffRecipeVersions(comparableBase, loaded.versions)) {
      issues.push({
        code: issue.code,
        path: `recipes/${issue.name}/${issue.version}`,
        message: issue.message,
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true };
}
