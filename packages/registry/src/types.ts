import type {
  RecipeManifest,
  RecipeSource,
  RecipeSummary,
  RecipeVersionListResponse,
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
  | "name_mismatch"
  | "invalid_version"
  | "version_mismatch"
  | "recipe_name_invalid"
  | "skill_description_missing"
  | "author_missing"
  | "author_url_invalid"
  | "compatibility_invalid"
  | "tag_invalid"
  | "filesystem_invalid"
  | "network_invalid"
  | "mcp_invalid"
  | "instructions_missing"
  | "unsafe_path"
  | "duplicate_path"
  | "package_too_large"
  | "too_many_files"
  | "package_structure";

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
  version?: string;
};

export type RecipeVersionList = RecipeVersionListResponse;

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
  get(name: string, version?: string): Promise<Recipe>;
  search(query: string): Promise<RecipeSummary[]>;
  fetchPackage(name: string, version?: string): Promise<RecipePackage>;
  listVersions(name: string): Promise<RecipeVersionList>;
}

export type RecipeValidation =
  { ok: true; recipe: Recipe } | { ok: false; errors: RecipeIssue[] };

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
