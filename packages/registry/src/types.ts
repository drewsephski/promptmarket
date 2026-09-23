import type { RecipeManifest } from "@promptmarket/schema";

export type RecipeIssueCode =
  | "manifest_missing"
  | "manifest_parse_error"
  | "manifest_invalid"
  | "skill_missing"
  | "frontmatter_missing"
  | "skill_parse_error"
  | "skill_invalid"
  | "name_mismatch";

export type RecipeIssue = {
  code: RecipeIssueCode;
  message: string;
  path: string;
};

export type SkillDocument = {
  name: string;
  description: string;
  body: string;
};

export type Recipe = {
  manifest: RecipeManifest;
  skill: SkillDocument;
  path: string;
};

export type RegistryOptions = {
  recipesDir?: string;
};

export type RegistryScan = {
  recipes: Recipe[];
  invalid: Array<{
    path: string;
    errors: RecipeIssue[];
  }>;
};

export interface Registry {
  list(): Promise<Recipe[]>;
  get(name: string): Promise<Recipe>;
  search(query: string): Promise<Recipe[]>;
}

export type RecipeValidation =
  { ok: true; recipe: Recipe } | { ok: false; errors: RecipeIssue[] };

export type InstallOptions = RegistryOptions & {
  projectDir?: string;
};

export type InstalledRecipe = {
  name: string;
  version: string;
  source: string;
  integrity: string;
  destination: string;
};
