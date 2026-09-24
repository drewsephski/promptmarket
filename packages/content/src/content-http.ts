import { buildContext, type ContextDetail } from "./context.js";
import { ContentError, ContentNotFoundError } from "./errors.js";
import type { ContentCatalog } from "./load.js";
import type { ContentMeta } from "./meta.js";
import { parseProjectContext } from "./project.js";

const PREFIX = "/api/content/v1";

function contentPathname(pathname: string): string {
  const index = pathname.indexOf(PREFIX);
  const rest = index >= 0 ? pathname.slice(index + PREFIX.length) : pathname;
  if (rest.length === 0) {
    return "/";
  }
  return rest.endsWith("/") ? rest.slice(0, -1) : rest;
}

function decodeSlug(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new ContentError("slug", `Could not decode ${segment}`);
  }
}

function jsonBody(body: unknown, status: number, etag?: string): Response {
  const headers = new Headers({
    "cache-control": "public, max-age=0, must-revalidate",
  });
  if (etag) {
    headers.set("etag", `"${etag}"`);
  }
  return Response.json(body, { status, headers });
}

export function contentErrorResponse(error: unknown): Response {
  if (error instanceof ContentNotFoundError) {
    return jsonBody({ error: error.message }, 404);
  }
  if (error instanceof ContentError) {
    return jsonBody({ error: error.message }, 400);
  }
  const message =
    error instanceof Error ? error.message : "Content request failed";
  return jsonBody({ error: message }, 500);
}

function parseDetail(value: string | null): ContextDetail | undefined {
  if (value === null) {
    return undefined;
  }
  if (value === "compact" || value === "full") {
    return value;
  }
  throw new ContentError("detail", 'Expected "compact" or "full"');
}

function parseMaxItems(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    throw new ContentError("maxItems", "Expected an integer from 1 to 10");
  }
  return Number(value);
}

function notModified(etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: {
      etag: `"${etag}"`,
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}

function wantsCached(request: Request, etag: string): boolean {
  const header = request.headers.get("if-none-match");
  if (!header) {
    return false;
  }
  return header.split(",").some(function matches(value) {
    return value.trim() === `"${etag}"` || value.trim() === etag;
  });
}

function parseProject(value: string | null) {
  if (value === null || value.length === 0) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ContentError("project", "Expected project to be JSON");
  }
  try {
    return parseProjectContext(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid project";
    throw new ContentError("project", message);
  }
}

export function handleContentRequest(
  catalog: ContentCatalog,
  request: Request,
  meta?: ContentMeta,
): Response {
  if (request.method !== "GET") {
    const response = jsonBody({ error: "Method not allowed" }, 405);
    response.headers.set("allow", "GET");
    return response;
  }

  let pathname = "/";
  let params: URLSearchParams = new URLSearchParams();
  try {
    const url = new URL(request.url);
    pathname = contentPathname(url.pathname);
    params = url.searchParams;
  } catch {
    return jsonBody({ error: "Invalid content URL" }, 400);
  }

  const etag = meta?.contentVersion;
  try {
    if (
      etag &&
      (pathname === "/meta" || pathname === "/catalog") &&
      wantsCached(request, etag)
    ) {
      return notModified(etag);
    }

    if (pathname === "/meta") {
      if (!meta) {
        return jsonBody({ error: "Content metadata is unavailable" }, 404);
      }
      return jsonBody(meta, 200, etag);
    }

    if (pathname === "/catalog") {
      return jsonBody(
        {
          ...(meta ?? { schemaVersion: 1 }),
          topics: catalog.topics,
          prompts: catalog.prompts,
          guides: catalog.guides,
        },
        200,
        etag,
      );
    }

    if (pathname === "/guides") {
      return jsonBody(
        catalog.guides.map(function summarize(guide) {
          return {
            slug: guide.slug,
            title: guide.title,
            description: guide.description,
            difficulty: guide.difficulty,
            stack: guide.stack,
            href: guide.href,
          };
        }),
        200,
        etag,
      );
    }

    if (pathname === "/search") {
      const query = params.get("q") ?? "";
      return jsonBody(
        {
          query,
          lessons: catalog.searchTopics(query),
          prompts: catalog.searchPrompts(query),
          guides: catalog.searchGuides(query),
        },
        200,
        etag,
      );
    }

    if (pathname === "/context") {
      const query = params.get("q") ?? "";
      return jsonBody(
        buildContext(catalog, {
          query,
          detail: parseDetail(params.get("detail")),
          maxItems: parseMaxItems(params.get("maxItems")),
          project: parseProject(params.get("project")),
        }),
        200,
        etag,
      );
    }

    const promptMatch = /^\/prompts\/([^/]+)$/.exec(pathname);
    if (promptMatch?.[1]) {
      return jsonBody(catalog.getPrompt(decodeSlug(promptMatch[1])), 200, etag);
    }

    const learnMatch = /^\/learn\/([^/]+)$/.exec(pathname);
    if (learnMatch?.[1]) {
      return jsonBody(catalog.getTopic(decodeSlug(learnMatch[1])), 200, etag);
    }

    const guideMatch = /^\/guides\/([^/]+)$/.exec(pathname);
    if (guideMatch?.[1]) {
      return jsonBody(catalog.getGuide(decodeSlug(guideMatch[1])), 200, etag);
    }

    return jsonBody({ error: "Unknown content route" }, 404);
  } catch (error) {
    return contentErrorResponse(error);
  }
}
