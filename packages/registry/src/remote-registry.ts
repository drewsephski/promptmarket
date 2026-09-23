import {
  RecipeDetailSchema,
  RecipeListResponseSchema,
  RecipeManifestSchema,
  RecipePackageResponseSchema,
  RecipeVersionListResponseSchema,
  RegistryErrorSchema,
  SemVerSchema,
  SkillNameSchema,
  type RecipeSource,
  type RecipeVersionListResponse,
} from "@promptmarket/schema";
import { digestFiles } from "./digest.js";
import {
  IntegrityError,
  InvalidRecipeError,
  InvalidRecipeNameError,
  InvalidRecipeVersionError,
  RecipeNotFoundError,
  RecipeVersionNotFoundError,
  RegistryLimitError,
} from "./errors.js";
import {
  MAX_PACKAGE_BYTES,
  MAX_PACKAGE_FILES,
  MAX_REGISTRY_RESPONSE_BYTES,
  REGISTRY_REQUEST_TIMEOUT_MS,
} from "./limits.js";
import { decodePackageFile } from "./package-encoding.js";
import { decodeRecipeText, normalizeRecipeFiles } from "./recipe-files.js";
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

function zodMessage(error: {
  issues: ReadonlyArray<{ message: string }>;
}): string {
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

  async get(name: string, version?: string): Promise<Recipe> {
    const recipeName = parseRecipeName(name);
    const recipeVersion = parseOptionalVersion(version);
    const payload = await this.request(recipePath(recipeName, recipeVersion));
    const parsed = RecipeDetailSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid registry response: ${zodMessage(parsed.error)}`);
    }
    if (
      parsed.data.name !== recipeName ||
      parsed.data.skill.name !== recipeName
    ) {
      throw new Error(
        `Invalid registry response: recipe name "${parsed.data.name}" does not match "${recipeName}"`,
      );
    }
    if (parsed.data.description !== parsed.data.skill.description) {
      throw new Error(
        "Invalid registry response: description does not match SKILL.md",
      );
    }
    if (recipeVersion && parsed.data.version !== recipeVersion) {
      throw new Error(
        `Registry returned version "${parsed.data.version}" for requested version "${recipeVersion}"`,
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

  async fetchPackage(name: string, version?: string): Promise<RecipePackage> {
    const recipeName = parseRecipeName(name);
    const recipeVersion = parseOptionalVersion(version);
    const payload = await this.request(
      `${recipePath(recipeName, recipeVersion)}/package`,
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
    if (recipeVersion && parsed.data.version !== recipeVersion) {
      throw new Error(
        `Registry returned version "${parsed.data.version}" for requested version "${recipeVersion}"`,
      );
    }

    const decoded: RecipeFile[] = parsed.data.files.map(
      function decodeFile(file) {
        return {
          path: file.path,
          contents: decodePackageFile(file),
        };
      },
    );
    assertPackageWithinLimits(decoded);
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
      skillFile
        ? decodeRecipeText(skillFile.contents, skillFile.path)
        : undefined,
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

  async listVersions(name: string): Promise<RecipeVersionListResponse> {
    const recipeName = parseRecipeName(name);
    const payload = await this.request(
      `/recipes/${encodeURIComponent(recipeName)}/versions`,
    );
    const parsed = RecipeVersionListResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid registry response: ${zodMessage(parsed.error)}`);
    }
    if (parsed.data.name !== recipeName) {
      throw new Error(
        `Invalid registry response: recipe name "${parsed.data.name}" does not match "${recipeName}"`,
      );
    }
    return parsed.data;
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
    const signal = AbortSignal.timeout(REGISTRY_REQUEST_TIMEOUT_MS);
    let response: Response;
    let text: string;
    try {
      response = await this.fetchImpl(url, {
        headers: { accept: "application/json" },
        signal,
      });
      text = await readBoundedBody(response, MAX_REGISTRY_RESPONSE_BYTES);
    } catch (error) {
      if (error instanceof RegistryLimitError) {
        throw error;
      }
      if (signal.aborted) {
        throw new Error("Registry request timed out");
      }
      const message = error instanceof Error ? error.message : "request failed";
      throw new Error(`Registry request failed: ${message}`);
    }

    let payload: unknown = null;
    if (text.length > 0) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = null;
      }
    }
    if (response.ok) {
      return payload;
    }

    const message = registryErrorMessage(payload, response.status);
    if (response.status === 404) {
      const identity = identityFromPath(suffix);
      if (identity?.version && identity.name) {
        throw new RecipeVersionNotFoundError(identity.name, identity.version);
      }
      if (identity?.name) {
        throw new RecipeNotFoundError(identity.name);
      }
    }
    throw new Error(message);
  }
}

export function assertPackageWithinLimits(
  files: RecipeFile[],
  limits: { maxFiles?: number; maxBytes?: number } = {},
): void {
  const maxFiles = limits.maxFiles ?? MAX_PACKAGE_FILES;
  const maxBytes = limits.maxBytes ?? MAX_PACKAGE_BYTES;
  if (files.length > maxFiles) {
    throw new RegistryLimitError(
      `Registry package has ${files.length} files, exceeding the limit of ${maxFiles}`,
    );
  }

  let total = 0;
  for (const file of files) {
    total += file.contents.byteLength;
    if (total > maxBytes) {
      throw new RegistryLimitError(
        `Registry package exceeds ${maxBytes} bytes`,
      );
    }
  }
}

function contentLength(response: Response): number | null {
  const header = response.headers.get("content-length");
  if (header === null) {
    return null;
  }
  const length = Number(header);
  if (!Number.isFinite(length) || length < 0) {
    return null;
  }
  return length;
}

export async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declared = contentLength(response);
  if (declared !== null && declared > maxBytes) {
    await response.body?.cancel();
    throw new RegistryLimitError(`Registry response exceeds ${maxBytes} bytes`);
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) {
      throw new RegistryLimitError(
        `Registry response exceeds ${maxBytes} bytes`,
      );
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RegistryLimitError(
        `Registry response exceeds ${maxBytes} bytes`,
      );
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function parseRecipeName(name: string): string {
  const parsed = SkillNameSchema.safeParse(name);
  if (!parsed.success) {
    throw new InvalidRecipeNameError(name);
  }
  return parsed.data;
}

function parseOptionalVersion(version: string | undefined): string | undefined {
  if (version === undefined) {
    return undefined;
  }
  const parsed = SemVerSchema.safeParse(version);
  if (!parsed.success) {
    throw new InvalidRecipeVersionError(version);
  }
  return parsed.data;
}

function recipePath(name: string, version: string | undefined): string {
  const encodedName = encodeURIComponent(name);
  if (!version) {
    return `/recipes/${encodedName}`;
  }
  return `/recipes/${encodedName}/versions/${encodeURIComponent(version)}`;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function identityFromPath(
  suffix: string,
): { name: string; version?: string } | undefined {
  const versioned = /^\/recipes\/([^/?]+)\/versions\/([^/?]+)/.exec(suffix);
  if (versioned?.[1] && versioned[2]) {
    return {
      name: decodeSegment(versioned[1]),
      version: decodeSegment(versioned[2]),
    };
  }
  const named = /^\/recipes\/([^/?]+)/.exec(suffix);
  if (!named?.[1]) {
    return undefined;
  }
  return { name: decodeSegment(named[1]) };
}

function registryErrorMessage(payload: unknown, status: number): string {
  const parsed = RegistryErrorSchema.safeParse(payload);
  if (parsed.success) {
    return parsed.data.error;
  }
  return `Registry request failed (${status})`;
}
