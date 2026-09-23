import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  SemVerSchema,
  SkillNameSchema,
  compareSemver,
  latestSemver,
  type RecipeSource,
  type RecipeVersionListResponse,
} from "@promptmarket/schema";
import { digestFiles } from "./digest.js";
import {
  InvalidRecipeError,
  InvalidRecipeNameError,
  InvalidRecipeVersionError,
  RecipeNotFoundError,
  RecipeVersionNotFoundError,
} from "./errors.js";
import { readRecipeFiles } from "./recipe-files.js";
import type {
  Recipe,
  RecipeIssue,
  RecipePackage,
  RecipeSummary,
  Registry,
  RegistryOptions,
  RegistryScan,
} from "./types.js";
import { validateRecipe } from "./validate-recipe.js";

export const FILE_RECIPE_SOURCE = {
  type: "file",
} as const satisfies RecipeSource;

type LoadedVersion = {
  version: string;
  recipe: Recipe;
  packagePath: string;
};

type LoadedCollection = {
  exists: boolean;
  valid: LoadedVersion[];
  invalid: RegistryScan["invalid"];
};

async function directoryExists(directory: string): Promise<boolean> {
  try {
    const info = await stat(directory);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

function containedJoin(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  const relative = path.relative(resolvedRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new InvalidRecipeNameError(segments.join("/"));
  }
  return target;
}

export async function resolveRecipesDir(
  options?: RegistryOptions,
): Promise<string> {
  if (options?.recipesDir) {
    return path.resolve(options.recipesDir);
  }

  let current = process.cwd();
  for (;;) {
    const candidate = path.join(current, "recipes");
    if (await directoryExists(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    "Could not find a recipes directory. Pass --recipes or run from a PromptMarket checkout.",
  );
}

function compareNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function parseRecipeName(name: string): string {
  const parsedName = SkillNameSchema.safeParse(name);
  if (!parsedName.success) {
    throw new InvalidRecipeNameError(name);
  }
  return parsedName.data;
}

function parseRecipeVersion(version: string): string {
  const parsedVersion = SemVerSchema.safeParse(version);
  if (!parsedVersion.success) {
    throw new InvalidRecipeVersionError(version);
  }
  return parsedVersion.data;
}

export function summarizeRecipe(recipe: Recipe): RecipeSummary {
  return {
    name: recipe.manifest.name,
    version: recipe.manifest.version,
    description: recipe.skill.description,
    tags: recipe.manifest.tags,
    compatibility: recipe.manifest.compatibility,
  };
}

async function loadCollection(
  recipesDir: string,
  collectionName: string,
): Promise<LoadedCollection> {
  const collectionPath = containedJoin(recipesDir, collectionName);
  if (!(await directoryExists(collectionPath))) {
    return { exists: false, valid: [], invalid: [] };
  }

  const invalid: RegistryScan["invalid"] = [];
  if (await fileExists(path.join(collectionPath, "promptmarket.yaml"))) {
    invalid.push({
      path: collectionPath,
      errors: [
        {
          code: "invalid_version",
          path: "promptmarket.yaml",
          message:
            "Recipe packages must live in version directories such as 0.1.0/",
        },
      ],
    });
  }

  const entries = await readdir(collectionPath, { withFileTypes: true });
  const directories = entries
    .filter(function isDirectory(entry) {
      return entry.isDirectory();
    })
    .sort(function byName(left, right) {
      return compareNames(left.name, right.name);
    });

  if (directories.length === 0) {
    invalid.push({
      path: collectionPath,
      errors: [
        {
          code: "invalid_version",
          path: collectionName,
          message: `Recipe "${collectionName}" has no version directories`,
        },
      ],
    });
  }

  const valid: LoadedVersion[] = [];
  for (const entry of directories) {
    const versionPath = containedJoin(collectionPath, entry.name);
    if (!SemVerSchema.safeParse(entry.name).success) {
      invalid.push({
        path: versionPath,
        errors: [
          {
            code: "invalid_version",
            path: entry.name,
            message: `Version directory "${entry.name}" is not a semantic version`,
          },
        ],
      });
      continue;
    }

    const result = await validateRecipe(versionPath);
    if (!result.ok) {
      invalid.push({
        path: versionPath,
        errors: result.errors,
      });
      continue;
    }
    valid.push({
      version: result.recipe.manifest.version,
      recipe: result.recipe,
      packagePath: versionPath,
    });
  }

  return { exists: true, valid, invalid };
}

function latestVersion(loaded: LoadedCollection): LoadedVersion | undefined {
  if (loaded.valid.length === 0) {
    return undefined;
  }
  const latest = latestSemver(
    loaded.valid.map(function versionOf(item) {
      return item.version;
    }),
  );
  return loaded.valid.find(function matchesLatest(item) {
    return item.version === latest;
  });
}

function invalidIssues(loaded: LoadedCollection): RecipeIssue[] {
  return loaded.invalid.flatMap(function issuesOf(item) {
    return item.errors;
  });
}

export async function scanRecipes(
  options?: RegistryOptions,
): Promise<RegistryScan> {
  const recipesDir = await resolveRecipesDir(options);
  if (!(await directoryExists(recipesDir))) {
    throw new Error(`Recipes directory not found: ${recipesDir}`);
  }

  const entries = await readdir(recipesDir, { withFileTypes: true });
  const directories = entries
    .filter(function isDirectory(entry) {
      return entry.isDirectory();
    })
    .sort(function byName(left, right) {
      return compareNames(left.name, right.name);
    });

  const recipes: Recipe[] = [];
  const invalid: RegistryScan["invalid"] = [];
  for (const entry of directories) {
    if (!SkillNameSchema.safeParse(entry.name).success) {
      invalid.push({
        path: path.join(recipesDir, entry.name),
        errors: [
          {
            code: "invalid_version",
            path: entry.name,
            message: `Recipe directory "${entry.name}" is not a valid recipe name`,
          },
        ],
      });
      continue;
    }

    const loaded = await loadCollection(recipesDir, entry.name);
    invalid.push(...loaded.invalid);
    const latest = latestVersion(loaded);
    if (latest) {
      recipes.push(latest.recipe);
    }
  }

  return { recipes, invalid };
}

export async function listRecipes(
  options?: RegistryOptions,
): Promise<RecipeSummary[]> {
  const scan = await scanRecipes(options);
  return scan.recipes.map(summarizeRecipe);
}

export async function getRecipe(
  name: string,
  options?: RegistryOptions,
): Promise<Recipe> {
  const recipeName = parseRecipeName(name);
  const version =
    options?.version === undefined
      ? undefined
      : parseRecipeVersion(options.version);
  const recipesDir = await resolveRecipesDir(options);
  if (!(await directoryExists(recipesDir))) {
    throw new Error(`Recipes directory not found: ${recipesDir}`);
  }

  const loaded = await loadCollection(recipesDir, recipeName);
  if (!loaded.exists) {
    throw new RecipeNotFoundError(recipeName);
  }

  if (version) {
    const versionPath = containedJoin(
      containedJoin(recipesDir, recipeName),
      version,
    );
    if (!(await directoryExists(versionPath))) {
      throw new RecipeVersionNotFoundError(recipeName, version);
    }
    const match = loaded.valid.find(function matchesVersion(item) {
      return item.version === version;
    });
    if (!match) {
      const failure = loaded.invalid.find(function matchesPath(item) {
        return item.path === versionPath;
      });
      throw new InvalidRecipeError(versionPath, failure?.errors ?? []);
    }
    return match.recipe;
  }

  const latest = latestVersion(loaded);
  if (!latest) {
    const issues = invalidIssues(loaded);
    throw new InvalidRecipeError(
      containedJoin(recipesDir, recipeName),
      issues.length > 0
        ? issues
        : [
            {
              code: "invalid_version",
              path: recipeName,
              message: `Recipe "${recipeName}" has no valid versions`,
            },
          ],
    );
  }
  return latest.recipe;
}

function recipeHaystack(recipe: Recipe): string {
  return [
    recipe.manifest.name,
    recipe.skill.name,
    recipe.skill.description,
    ...recipe.manifest.tags,
  ]
    .join("\n")
    .toLowerCase();
}

export async function searchRecipes(
  query: string,
  options?: RegistryOptions,
): Promise<RecipeSummary[]> {
  const scan = await scanRecipes(options);
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter(function nonEmpty(token) {
      return token.length > 0;
    });

  return scan.recipes
    .filter(function matchesQuery(recipe) {
      const haystack = recipeHaystack(recipe);
      return tokens.every(function tokenInHaystack(token) {
        return haystack.includes(token);
      });
    })
    .map(summarizeRecipe);
}

async function resolvePackage(
  name: string,
  options?: RegistryOptions,
): Promise<LoadedVersion> {
  const recipeName = parseRecipeName(name);
  const version =
    options?.version === undefined
      ? undefined
      : parseRecipeVersion(options.version);
  const recipesDir = await resolveRecipesDir(options);
  const loaded = await loadCollection(recipesDir, recipeName);
  if (!loaded.exists) {
    throw new RecipeNotFoundError(recipeName);
  }
  if (version) {
    const match = loaded.valid.find(function matchesVersion(item) {
      return item.version === version;
    });
    if (match) {
      return match;
    }
    const versionPath = containedJoin(
      containedJoin(recipesDir, recipeName),
      version,
    );
    if (!(await directoryExists(versionPath))) {
      throw new RecipeVersionNotFoundError(recipeName, version);
    }
    const failure = loaded.invalid.find(function matchesPath(item) {
      return item.path === versionPath;
    });
    throw new InvalidRecipeError(versionPath, failure?.errors ?? []);
  }
  const latest = latestVersion(loaded);
  if (!latest) {
    throw new InvalidRecipeError(
      containedJoin(recipesDir, recipeName),
      invalidIssues(loaded),
    );
  }
  return latest;
}

export async function fetchRecipePackage(
  name: string,
  options?: RegistryOptions,
): Promise<RecipePackage> {
  const resolved = await resolvePackage(name, options);
  const files = await readRecipeFiles(resolved.packagePath);
  return {
    recipe: resolved.recipe,
    files,
    integrity: digestFiles(files),
  };
}

export async function listRecipeVersions(
  name: string,
  options?: RegistryOptions,
): Promise<RecipeVersionListResponse> {
  const recipeName = parseRecipeName(name);
  const recipesDir = await resolveRecipesDir(options);
  const loaded = await loadCollection(recipesDir, recipeName);
  if (!loaded.exists) {
    throw new RecipeNotFoundError(recipeName);
  }
  const latest = latestVersion(loaded);
  if (!latest) {
    throw new InvalidRecipeError(
      containedJoin(recipesDir, recipeName),
      invalidIssues(loaded),
    );
  }

  const versions = await Promise.all(
    loaded.valid.map(async function describeVersion(item) {
      const files = await readRecipeFiles(item.packagePath);
      return {
        version: item.version,
        integrity: digestFiles(files),
      };
    }),
  );
  versions.sort(function bySemverDescending(left, right) {
    const compared = compareSemver(right.version, left.version);
    if (compared !== 0) {
      return compared;
    }
    if (left.version < right.version) {
      return -1;
    }
    if (left.version > right.version) {
      return 1;
    }
    return 0;
  });

  return {
    name: recipeName,
    latest: latest.version,
    versions,
  };
}

export class FileRegistry implements Registry {
  readonly source = FILE_RECIPE_SOURCE;

  constructor(private readonly options?: RegistryOptions) {}

  list(): Promise<RecipeSummary[]> {
    return listRecipes(this.options);
  }

  get(name: string, version?: string): Promise<Recipe> {
    return getRecipe(name, { ...this.options, version });
  }

  search(query: string): Promise<RecipeSummary[]> {
    return searchRecipes(query, this.options);
  }

  fetchPackage(name: string, version?: string): Promise<RecipePackage> {
    return fetchRecipePackage(name, { ...this.options, version });
  }

  listVersions(name: string): Promise<RecipeVersionListResponse> {
    return listRecipeVersions(name, this.options);
  }

  scan(): Promise<RegistryScan> {
    return scanRecipes(this.options);
  }
}
