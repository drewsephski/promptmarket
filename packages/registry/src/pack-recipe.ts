import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { tarGzRecipeArchive } from "./archive.js";
import { digestFiles } from "./digest.js";
import { InvalidRecipeError } from "./errors.js";
import { assertPackageWithinLimits } from "./remote-registry.js";
import { normalizeRecipeFiles, readRecipeFiles } from "./recipe-files.js";
import type { RecipeFile } from "./types.js";
import { validateRecipe } from "./validate-recipe.js";

export type PackedRecipe = {
  name: string;
  version: string;
  integrity: string;
  fileCount: number;
  bytes: number;
  artifactPath: string;
  files: string[];
};

function packageBytes(files: RecipeFile[]): number {
  return files.reduce(function sum(total, file) {
    return total + file.contents.byteLength;
  }, 0);
}

export function artifactFileName(name: string, version: string): string {
  return `${name}-${version.replaceAll("+", "-")}.tgz`;
}

export async function defaultPackOutDir(recipePath: string): Promise<string> {
  const recipeDir = await realpath(path.resolve(recipePath));
  const cwd = await realpath(process.cwd());
  const cwdDist = path.join(cwd, "dist");
  const relative = path.relative(recipeDir, cwdDist);
  const insideRecipe =
    relative === "" ||
    (relative !== "" &&
      !relative.startsWith("..") &&
      !path.isAbsolute(relative));
  if (insideRecipe) {
    return path.resolve(recipeDir, "..", "dist");
  }
  return cwdDist;
}

export async function packRecipe(
  recipePath: string,
  options?: { outDir?: string },
): Promise<PackedRecipe> {
  const validation = await validateRecipe(recipePath);
  if (!validation.ok) {
    throw new InvalidRecipeError(recipePath, validation.errors);
  }

  const files = normalizeRecipeFiles(await readRecipeFiles(recipePath));
  assertPackageWithinLimits(files);
  const integrity = digestFiles(files);
  const name = validation.recipe.manifest.name;
  const version = validation.recipe.manifest.version;
  const outDir = path.resolve(
    options?.outDir ?? (await defaultPackOutDir(recipePath)),
  );
  const artifactPath = path.join(outDir, artifactFileName(name, version));
  await mkdir(outDir, { recursive: true });
  await writeFile(artifactPath, tarGzRecipeArchive(name, files));

  return {
    name,
    version,
    integrity,
    fileCount: files.length,
    bytes: packageBytes(files),
    artifactPath,
    files: files
      .map(function pathOf(file) {
        return file.path;
      })
      .sort(function byPath(left, right) {
        if (left < right) {
          return -1;
        }
        if (left > right) {
          return 1;
        }
        return 0;
      }),
  };
}
