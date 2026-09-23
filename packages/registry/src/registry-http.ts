import {
  RecipeDetailSchema,
  RecipeListResponseSchema,
  RecipePackageResponseSchema,
  type RecipeDetail,
  type RecipeListResponse,
  type RecipePackageResponse,
} from "@promptmarket/schema";
import {
  InvalidRecipeError,
  InvalidRecipeNameError,
  RecipeNotFoundError,
} from "./errors.js";
import { decodeRecipeText } from "./recipe-files.js";
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
      return {
        path: file.path,
        content: decodeRecipeText(file.contents, file.path),
      };
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

export function registryErrorResponse(error: unknown): Response {
  if (error instanceof RecipeNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof InvalidRecipeNameError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof InvalidRecipeError) {
    return Response.json({ error: error.message }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : "Registry request failed";
  return Response.json({ error: message }, { status: 500 });
}

export async function handleRegistryRequest(
  registry: Registry,
  request: Request,
): Promise<Response> {
  if (request.method !== "GET") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: { allow: "GET" } },
    );
  }

  let pathname = "/";
  let query: string | null = null;
  try {
    const url = new URL(request.url);
    pathname = registryPathname(url.pathname);
    query = url.searchParams.get("q");
  } catch {
    return Response.json({ error: "Invalid registry URL" }, { status: 400 });
  }

  try {
    if (pathname === "/recipes") {
      const recipes =
        query === null ? await registry.list() : await registry.search(query);
      const body: RecipeListResponse = RecipeListResponseSchema.parse({ recipes });
      return Response.json(body);
    }

    const packageMatch = /^\/recipes\/([^/]+)\/package$/.exec(pathname);
    if (packageMatch?.[1]) {
      const pkg = await registry.fetchPackage(decodeName(packageMatch[1]));
      return Response.json(toPackageResponse(pkg));
    }

    const recipeMatch = /^\/recipes\/([^/]+)$/.exec(pathname);
    if (recipeMatch?.[1]) {
      const pkg = await registry.fetchPackage(decodeName(recipeMatch[1]));
      return Response.json(toRecipeDetail(pkg));
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return registryErrorResponse(error);
  }
}
