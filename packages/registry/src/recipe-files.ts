import {
  readdir,
  readFile,
  rename,
  rm,
  mkdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { UnsafeRecipePathError } from "./errors.js";
import { MAX_RECIPE_PATH_LENGTH } from "./limits.js";
import type { RecipeFile } from "./types.js";

function compareNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function assertSafeRelativePath(filePath: string): string {
  if (
    filePath.length === 0 ||
    filePath.length > MAX_RECIPE_PATH_LENGTH ||
    filePath.includes("\0")
  ) {
    throw new UnsafeRecipePathError(filePath);
  }
  if (
    filePath.startsWith("/") ||
    filePath.startsWith("\\") ||
    /^[A-Za-z]:/.test(filePath)
  ) {
    throw new UnsafeRecipePathError(filePath);
  }

  const normalized = filePath.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    segments.some(function isUnsafe(segment) {
      return segment === "" || segment === "." || segment === "..";
    })
  ) {
    throw new UnsafeRecipePathError(filePath);
  }

  if (normalized.length > MAX_RECIPE_PATH_LENGTH) {
    throw new UnsafeRecipePathError(filePath);
  }

  return normalized;
}

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export function decodeRecipeText(
  contents: Uint8Array,
  filePath: string,
): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(contents);
  } catch {
    throw new Error(`Recipe file is not UTF-8: ${filePath}`);
  }
}

export function encodeRecipeText(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

export async function readRecipeFiles(
  recipePath: string,
): Promise<RecipeFile[]> {
  const root = path.resolve(recipePath);
  const files: RecipeFile[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    const sorted = [...entries].sort(function byName(left, right) {
      return compareNames(left.name, right.name);
    });

    for (const entry of sorted) {
      if (entry.name === ".DS_Store") {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      const relativePath = assertSafeRelativePath(
        toPosix(path.relative(root, fullPath)),
      );
      if (entry.isSymbolicLink()) {
        throw new UnsafeRecipePathError(relativePath);
      }
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      files.push({
        path: relativePath,
        contents: await readFile(fullPath),
      });
    }
  }

  await walk(root);
  return files;
}

export function normalizeRecipeFiles(files: RecipeFile[]): RecipeFile[] {
  const seen = new Set<string>();
  const normalized: RecipeFile[] = [];
  for (const file of files) {
    const safePath = assertSafeRelativePath(file.path);
    if (seen.has(safePath)) {
      throw new Error(`Duplicate recipe path: ${safePath}`);
    }
    seen.add(safePath);
    normalized.push({ path: safePath, contents: file.contents });
  }
  return normalized;
}

function resolveInside(root: string, filePath: string): string {
  const safePath = assertSafeRelativePath(filePath);
  const target = path.resolve(root, ...safePath.split("/"));
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new UnsafeRecipePathError(filePath);
  }
  return target;
}

export async function writeRecipeFiles(
  destination: string,
  files: RecipeFile[],
): Promise<void> {
  const root = path.resolve(destination);
  const staged = `${root}.tmp`;
  const targets = files.map(function locate(file) {
    return {
      contents: file.contents,
      target: resolveInside(staged, file.path),
    };
  });

  await rm(staged, { recursive: true, force: true });
  await mkdir(staged, { recursive: true });
  try {
    for (const file of targets) {
      await mkdir(path.dirname(file.target), { recursive: true });
      await writeFile(file.target, file.contents);
    }
    await rm(root, { recursive: true, force: true });
    await rename(staged, root);
  } catch (error) {
    await rm(staged, { recursive: true, force: true });
    throw error;
  }
}
