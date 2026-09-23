import {
  RecipeDetailSchema,
  RecipeListResponseSchema,
  RecipePackageResponseSchema,
  RecipeVersionListResponseSchema,
  type RecipeDetail,
  type RecipeListResponse,
  type RecipePackageResponse,
  type RecipeVersionListResponse,
} from "@promptmarket/schema";
import {
  InvalidRecipeError,
  InvalidRecipeNameError,
  InvalidRecipeVersionError,
  RecipeNotFoundError,
  RecipeVersionNotFoundError,
} from "./errors.js";
import { encodePackageFile } from "./package-encoding.js";
import type { RecipePackage, Registry } from "./types.js";

const PREFIX = "/api/registry/v1";

export function toRecipeDetail(pkg: RecipePackage): RecipeDetail {
  return RecipeDetailSchema.parse({
    schemaVersion: pkg.recipe.manifest.schemaVersion,
    name: pkg.recipe.manifest.name,
    version: pkg.recipe.manifest.version,
    description: pkg.recipe.skill.description,
    author: pkg.recipe.manifest.author,
    compatibility: pkg.recipe.manifest.compatibility,
    requires: pkg.recipe.manifest.requires,
    capabilities: pkg.recipe.manifest.capabilities,
    entrypoint: pkg.recipe.manifest.entrypoint,
    tags: pkg.recipe.manifest.tags,
    integrity: pkg.integrity,
    skill: pkg.recipe.skill,
  });
}

export function toPackageResponse(pkg: RecipePackage): RecipePackageResponse {
  return RecipePackageResponseSchema.parse({
    name: pkg.recipe.manifest.name,
    version: pkg.recipe.manifest.version,
    integrity: pkg.integrity,
    files: pkg.files.map(function encodeFile(file) {
      return encodePackageFile(file);
    }),
  });
}

function registryPathname(pathname: string): string {
  const index = pathname.indexOf(PREFIX);
  const rest = index >= 0 ? pathname.slice(index + PREFIX.length) : pathname;
  if (rest.length === 0) {
    return "/";
  }
  return rest.endsWith("/") ? rest.slice(0, -1) : rest;
}

function decodeName(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new InvalidRecipeNameError(segment);
  }
}

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const MUTABLE_CACHE = "public, max-age=0, must-revalidate";

function jsonBody(
  body: unknown,
  status: number,
  cache: "immutable" | "mutable" | "none",
): Response {
  const cacheControl =
    cache === "immutable"
      ? IMMUTABLE_CACHE
      : cache === "mutable"
        ? MUTABLE_CACHE
        : "no-store";
  return Response.json(body, {
    status,
    headers: { "cache-control": cacheControl },
  });
}

export function registryErrorResponse(error: unknown): Response {
  if (
    error instanceof RecipeNotFoundError ||
    error instanceof RecipeVersionNotFoundError
  ) {
    return jsonBody({ error: error.message }, 404, "none");
  }
  if (
    error instanceof InvalidRecipeNameError ||
    error instanceof InvalidRecipeVersionError
  ) {
    return jsonBody({ error: error.message }, 400, "none");
  }
  if (error instanceof InvalidRecipeError) {
    return jsonBody({ error: error.message }, 422, "none");
  }
  const message =
    error instanceof Error ? error.message : "Registry request failed";
  return jsonBody({ error: message }, 500, "none");
}

export async function handleRegistryRequest(
  registry: Registry,
  request: Request,
): Promise<Response> {
  if (request.method !== "GET") {
    const response = jsonBody({ error: "Method not allowed" }, 405, "none");
    response.headers.set("allow", "GET");
    return response;
  }

  let pathname = "/";
  let query: string | null = null;
  try {
    const url = new URL(request.url);
    pathname = registryPathname(url.pathname);
    query = url.searchParams.get("q");
  } catch {
    return jsonBody({ error: "Invalid registry URL" }, 400, "none");
  }

  try {
    if (pathname === "/recipes") {
      const recipes =
        query === null ? await registry.list() : await registry.search(query);
      const body: RecipeListResponse = RecipeListResponseSchema.parse({
        recipes,
      });
      return jsonBody(body, 200, "mutable");
    }

    const versionPackageMatch =
      /^\/recipes\/([^/]+)\/versions\/([^/]+)\/package$/.exec(pathname);
    if (versionPackageMatch?.[1] && versionPackageMatch[2]) {
      const pkg = await registry.fetchPackage(
        decodeName(versionPackageMatch[1]),
        decodeName(versionPackageMatch[2]),
      );
      return jsonBody(toPackageResponse(pkg), 200, "immutable");
    }

    const versionMatch = /^\/recipes\/([^/]+)\/versions\/([^/]+)$/.exec(
      pathname,
    );
    if (versionMatch?.[1] && versionMatch[2]) {
      const pkg = await registry.fetchPackage(
        decodeName(versionMatch[1]),
        decodeName(versionMatch[2]),
      );
      return jsonBody(toRecipeDetail(pkg), 200, "immutable");
    }

    const versionListMatch = /^\/recipes\/([^/]+)\/versions$/.exec(pathname);
    if (versionListMatch?.[1]) {
      const body: RecipeVersionListResponse =
        RecipeVersionListResponseSchema.parse(
          await registry.listVersions(decodeName(versionListMatch[1])),
        );
      return jsonBody(body, 200, "mutable");
    }

    const packageMatch = /^\/recipes\/([^/]+)\/package$/.exec(pathname);
    if (packageMatch?.[1]) {
      const pkg = await registry.fetchPackage(decodeName(packageMatch[1]));
      return jsonBody(toPackageResponse(pkg), 200, "mutable");
    }

    const recipeMatch = /^\/recipes\/([^/]+)$/.exec(pathname);
    if (recipeMatch?.[1]) {
      const pkg = await registry.fetchPackage(decodeName(recipeMatch[1]));
      return jsonBody(toRecipeDetail(pkg), 200, "mutable");
    }

    return jsonBody({ error: "Not found" }, 404, "none");
  } catch (error) {
    return registryErrorResponse(error);
  }
}
