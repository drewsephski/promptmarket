import type {
  RecipeManifest,
  RecipeSource,
  RecipeSummary,
  SkillDocument,
} from "@promptmarket/schema";

export type { RecipeSource, RecipeSummary, SkillDocument };

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

export type Recipe = {
  manifest: RecipeManifest;
  skill: SkillDocument;
};

export type RecipeFile = {
  path: string;
  contents: Uint8Array;
};

export type RecipePackage = {
  recipe: Recipe;
  files: RecipeFile[];
  integrity: string;
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
  readonly source: RecipeSource;
  list(): Promise<RecipeSummary[]>;
  get(name: string): Promise<Recipe>;
  search(query: string): Promise<RecipeSummary[]>;
  fetchPackage(name: string): Promise<RecipePackage>;
}

export type RecipeValidation =
  | { ok: true; recipe: Recipe }
  | { ok: false; errors: RecipeIssue[] };

export type InstallOptions = {
  registry: Registry;
  projectDir?: string;
};

export type InstalledRecipe = {
  name: string;
  version: string;
  source: RecipeSource;
  integrity: string;
  destination: string;
};
