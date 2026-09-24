import { buildContext, type ContextDetail } from "./context.js";
import { ContentError, ContentNotFoundError } from "./errors.js";
import type { ContentCatalog } from "./load.js";

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

function jsonBody(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "public, max-age=0, must-revalidate" },
  });
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

export function handleContentRequest(
  catalog: ContentCatalog,
  request: Request,
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

  try {
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
      );
    }

    if (pathname === "/context") {
      const query = params.get("q") ?? "";
      return jsonBody(
        buildContext(catalog, {
          query,
          detail: parseDetail(params.get("detail")),
          maxItems: parseMaxItems(params.get("maxItems")),
        }),
        200,
      );
    }

    const promptMatch = /^\/prompts\/([^/]+)$/.exec(pathname);
    if (promptMatch?.[1]) {
      return jsonBody(catalog.getPrompt(decodeSlug(promptMatch[1])), 200);
    }

    const learnMatch = /^\/learn\/([^/]+)$/.exec(pathname);
    if (learnMatch?.[1]) {
      return jsonBody(catalog.getTopic(decodeSlug(learnMatch[1])), 200);
    }

    const guideMatch = /^\/guides\/([^/]+)$/.exec(pathname);
    if (guideMatch?.[1]) {
      return jsonBody(catalog.getGuide(decodeSlug(guideMatch[1])), 200);
    }

    return jsonBody({ error: "Unknown content route" }, 404);
  } catch (error) {
    return contentErrorResponse(error);
  }
}
