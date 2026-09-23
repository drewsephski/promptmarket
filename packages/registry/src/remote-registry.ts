import {
  RecipeDetailSchema,
  RecipeListResponseSchema,
  RecipeManifestSchema,
  RecipePackageResponseSchema,
  RegistryErrorSchema,
  SkillNameSchema,
  type RecipeSource,
} from "@promptmarket/schema";
import { digestFiles } from "./digest.js";
import {
  IntegrityError,
  InvalidRecipeError,
  InvalidRecipeNameError,
  RecipeNotFoundError,
} from "./errors.js";
import {
  decodeRecipeText,
  encodeRecipeText,
  normalizeRecipeFiles,
} from "./recipe-files.js";
import type {
  Recipe,
  RecipeFile,
  RecipePackage,
  RecipeSummary,
  Registry,
} from "./types.js";
import { validateRecipeTexts } from "./validate-recipe.js";

export const DEFAULT_REGISTRY_URL = "https://promptmarket.sh/api/registry/v1";

function registryUrl(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid registry URL: ${baseUrl}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid registry URL: ${baseUrl}`);
  }
  parsed.hash = "";
  parsed.search = "";
  const href = parsed.href.replace(/\/$/, "");
  return href;
}

function zodMessage(error: { issues: ReadonlyArray<{ message: string }> }): string {
  return error.issues
    .map(function formatIssue(issue) {
      return issue.message;
    })
    .join("; ");
}

export class RemoteRegistry implements Registry {
  readonly source: RecipeSource;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    baseUrl: string = DEFAULT_REGISTRY_URL,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = registryUrl(baseUrl);
    this.fetchImpl = fetchImpl;
    this.source = { type: "registry", url: this.baseUrl };
  }

  list(): Promise<RecipeSummary[]> {
    return this.readList(null);
  }

  async get(name: string): Promise<Recipe> {
    const recipeName = parseRecipeName(name);
    const payload = await this.request(`/recipes/${encodeURIComponent(recipeName)}`);
    const parsed = RecipeDetailSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid registry response: ${zodMessage(parsed.error)}`);
    }
    if (parsed.data.name !== recipeName || parsed.data.skill.name !== recipeName) {
      throw new Error(
        `Invalid registry response: recipe name "${parsed.data.name}" does not match "${recipeName}"`,
      );
    }
    if (parsed.data.description !== parsed.data.skill.description) {
      throw new Error(
        "Invalid registry response: description does not match SKILL.md",
      );
    }

    const manifest = RecipeManifestSchema.parse({
      schemaVersion: parsed.data.schemaVersion,
      name: parsed.data.name,
      version: parsed.data.version,
      author: parsed.data.author,
      compatibility: parsed.data.compatibility,
      requires: parsed.data.requires,
      capabilities: parsed.data.capabilities,
      entrypoint: parsed.data.entrypoint,
      tags: parsed.data.tags,
    });

    return {
      manifest,
      skill: parsed.data.skill,
    };
  }

  search(query: string): Promise<RecipeSummary[]> {
    return this.readList(query);
  }

  async fetchPackage(name: string): Promise<RecipePackage> {
    const recipeName = parseRecipeName(name);
    const payload = await this.request(
      `/recipes/${encodeURIComponent(recipeName)}/package`,
    );
    const parsed = RecipePackageResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid registry response: ${zodMessage(parsed.error)}`);
    }
    if (parsed.data.name !== recipeName) {
      throw new Error(
        `Invalid registry response: package name "${parsed.data.name}" does not match "${recipeName}"`,
      );
    }

    const decoded: RecipeFile[] = parsed.data.files.map(function decodeFile(file) {
      return {
        path: file.path,
        contents: encodeRecipeText(file.content),
      };
    });
    const files = normalizeRecipeFiles(decoded);
    const integrity = digestFiles(files);
    if (integrity !== parsed.data.integrity) {
      throw new IntegrityError(parsed.data.integrity, integrity);
    }

    const manifestFile = files.find(function isManifest(file) {
      return file.path === "promptmarket.yaml";
    });
    const skillFile = files.find(function isSkill(file) {
      return file.path === "SKILL.md";
    });
    const result = validateRecipeTexts(
      recipeName,
      manifestFile
        ? decodeRecipeText(manifestFile.contents, manifestFile.path)
        : undefined,
      skillFile ? decodeRecipeText(skillFile.contents, skillFile.path) : undefined,
    );
    if (!result.ok) {
      throw new InvalidRecipeError(recipeName, result.errors);
    }
    if (
      result.recipe.manifest.name !== parsed.data.name ||
      result.recipe.manifest.version !== parsed.data.version
    ) {
      throw new Error(
        "Invalid registry response: package metadata does not match promptmarket.yaml",
      );
    }

    return {
      recipe: result.recipe,
      files,
      integrity,
    };
  }

  private async readList(query: string | null): Promise<RecipeSummary[]> {
    const suffix =
      query === null
        ? "/recipes"
        : `/recipes?${new URLSearchParams({ q: query }).toString()}`;
    const payload = await this.request(suffix);
    const parsed = RecipeListResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid registry response: ${zodMessage(parsed.error)}`);
    }
    return parsed.data.recipes;
  }

  private async request(suffix: string): Promise<unknown> {
    const url = `${this.baseUrl}${suffix}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { accept: "application/json" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "request failed";
      throw new Error(`Registry request failed: ${message}`);
    }

    const payload: unknown = await response.json().catch(function invalidJson() {
      return null;
    });
    if (response.ok) {
      return payload;
    }

    const message = registryErrorMessage(payload, response.status);
    if (response.status === 404) {
      const recipeName = recipeNameFromPath(suffix);
      if (recipeName) {
        throw new RecipeNotFoundError(recipeName);
      }
    }
    throw new Error(message);
  }
}

function parseRecipeName(name: string): string {
  const parsed = SkillNameSchema.safeParse(name);
  if (!parsed.success) {
    throw new InvalidRecipeNameError(name);
  }
  return parsed.data;
}

function recipeNameFromPath(suffix: string): string | undefined {
  const match = /^\/recipes\/([^/?]+)/.exec(suffix);
  if (!match?.[1]) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function registryErrorMessage(payload: unknown, status: number): string {
  const parsed = RegistryErrorSchema.safeParse(payload);
  if (parsed.success) {
    return parsed.data.error;
  }
  return `Registry request failed (${status})`;
}
