import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { UnsafeRecipePathError } from "./errors.js";
import { MAX_PACKAGE_BYTES, MAX_PACKAGE_FILES } from "./limits.js";
import { assertSafeRelativePath } from "./recipe-files.js";
import type { RecipeFile, RecipeIssue } from "./types.js";

function compareNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export function inspectRecipeFiles(files: RecipeFile[]): RecipeIssue[] {
  const issues: RecipeIssue[] = [];
  const seen = new Set<string>();
  const safeFiles: RecipeFile[] = [];

  for (const file of files) {
    let safePath: string;
    try {
      safePath = assertSafeRelativePath(file.path);
    } catch (error) {
      if (error instanceof UnsafeRecipePathError) {
        issues.push({
          code: "unsafe_path",
          path: file.path.length > 0 ? file.path : ".",
          message: error.message,
        });
        continue;
      }
      throw error;
    }

    if (seen.has(safePath)) {
      issues.push({
        code: "duplicate_path",
        path: safePath,
        message: `Duplicate recipe path: ${safePath}`,
      });
      continue;
    }
    seen.add(safePath);
    safeFiles.push({ path: safePath, contents: file.contents });
  }

  if (safeFiles.length > MAX_PACKAGE_FILES) {
    issues.push({
      code: "too_many_files",
      path: ".",
      message: `Recipe package has ${safeFiles.length} files, exceeding the limit of ${MAX_PACKAGE_FILES}`,
    });
  }

  let total = 0;
  for (const file of safeFiles) {
    total += file.contents.byteLength;
  }
  if (total > MAX_PACKAGE_BYTES) {
    issues.push({
      code: "package_too_large",
      path: ".",
      message: `Recipe package exceeds ${MAX_PACKAGE_BYTES} bytes`,
    });
  }

  return issues;
}

export async function auditRecipeDirectory(
  recipePath: string,
): Promise<RecipeIssue[]> {
  const root = path.resolve(recipePath);
  const issues: RecipeIssue[] = [];
  const files: RecipeFile[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      const code =
        error instanceof Error && "code" in error ? error.code : undefined;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return;
      }
      throw error;
    }

    const sorted = [...entries].sort(function byName(left, right) {
      return compareNames(left.name, right.name);
    });

    for (const entry of sorted) {
      if (entry.name === ".DS_Store") {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      const relative = toPosix(path.relative(root, fullPath));
      if (entry.isSymbolicLink()) {
        issues.push({
          code: "unsafe_path",
          path: relative,
          message: `Unsafe recipe path: ${relative}`,
        });
        continue;
      }
      if (entry.isDirectory()) {
        let safeDirectory = relative;
        try {
          safeDirectory = assertSafeRelativePath(relative);
        } catch (error) {
          if (error instanceof UnsafeRecipePathError) {
            issues.push({
              code: "unsafe_path",
              path: relative,
              message: error.message,
            });
            continue;
          }
          throw error;
        }
        await walk(path.join(root, ...safeDirectory.split("/")));
        continue;
      }
      if (!entry.isFile()) {
        issues.push({
          code: "package_structure",
          path: relative,
          message: `Recipe package contains an unsupported entry: ${relative}`,
        });
        continue;
      }

      let safePath: string;
      try {
        safePath = assertSafeRelativePath(relative);
      } catch (error) {
        if (error instanceof UnsafeRecipePathError) {
          issues.push({
            code: "unsafe_path",
            path: relative,
            message: error.message,
          });
          continue;
        }
        throw error;
      }
      files.push({
        path: safePath,
        contents: await readFile(fullPath),
      });
    }
  }

  await walk(root);
  return [...issues, ...inspectRecipeFiles(files)];
}
