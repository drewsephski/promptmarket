import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { SkillNameSchema } from "@promptmarket/schema";
import {
  InvalidRecipeError,
  InvalidRecipeNameError,
  RecipeNotFoundError,
} from "./errors.js";
import type {
  Recipe,
  Registry,
  RegistryOptions,
  RegistryScan,
} from "./types.js";
import { validateRecipe } from "./validate-recipe.js";

export const FILE_REGISTRY_SOURCE = "file";

async function directoryExists(directory: string): Promise<boolean> {
  try {
    const info = await stat(directory);
    return info.isDirectory();
  } catch {
    return false;
  }
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
    const recipePath = path.join(recipesDir, entry.name);
    const manifestPath = path.join(recipePath, "promptmarket.yaml");
    try {
      const info = await stat(manifestPath);
      if (!info.isFile()) {
        continue;
      }
    } catch {
      continue;
    }

    const result = await validateRecipe(recipePath);
    if (!result.ok) {
      invalid.push({ path: recipePath, errors: result.errors });
      continue;
    }
    recipes.push(result.recipe);
  }

  return { recipes, invalid };
}

export async function listRecipes(
  options?: RegistryOptions,
): Promise<Recipe[]> {
  const scan = await scanRecipes(options);
  return scan.recipes;
}

export async function getRecipe(
  name: string,
  options?: RegistryOptions,
): Promise<Recipe> {
  const parsedName = SkillNameSchema.safeParse(name);
  if (!parsedName.success) {
    throw new InvalidRecipeNameError(name);
  }

  const recipesDir = await resolveRecipesDir(options);
  if (!(await directoryExists(recipesDir))) {
    throw new Error(`Recipes directory not found: ${recipesDir}`);
  }

  const recipePath = path.join(recipesDir, parsedName.data);
  if (!(await directoryExists(recipePath))) {
    throw new RecipeNotFoundError(parsedName.data);
  }

  const result = await validateRecipe(recipePath);
  if (!result.ok) {
    throw new InvalidRecipeError(recipePath, result.errors);
  }
  return result.recipe;
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
): Promise<Recipe[]> {
  const scan = await scanRecipes(options);
  const recipes = scan.recipes;
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter(function nonEmpty(token) {
      return token.length > 0;
    });

  return recipes.filter(function matchesQuery(recipe) {
    const haystack = recipeHaystack(recipe);
    return tokens.every(function tokenInHaystack(token) {
      return haystack.includes(token);
    });
  });
}

export class FileRegistry implements Registry {
  readonly source = FILE_REGISTRY_SOURCE;

  constructor(private readonly options?: RegistryOptions) {}

  list(): Promise<Recipe[]> {
    return listRecipes(this.options);
  }

  get(name: string): Promise<Recipe> {
    return getRecipe(name, this.options);
  }

  search(query: string): Promise<Recipe[]> {
    return searchRecipes(query, this.options);
  }

  scan(): Promise<RegistryScan> {
    return scanRecipes(this.options);
  }
}
