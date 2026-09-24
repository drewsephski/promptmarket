import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  contentMeta,
  createContentCatalog,
  loadContentCatalog,
  resolveContentDir,
  type ContentCatalog,
  type Guide,
  type LearnTopic,
  type PromptDocument,
} from "@promptmarket/content";

export const CLI_VERSION = "0.4.0";
export const DEFAULT_CONTENT_API = "https://promptmarket.sh/api/content/v1";

export type ContentSourceName = "hosted" | "cache" | "offline" | "directory";

export type ResolvedContent = {
  catalog: ContentCatalog;
  source: ContentSourceName;
  version: string;
  updatedAt: string;
};

type CatalogPayload = {
  contentVersion?: string;
  updatedAt?: string;
  topics: LearnTopic[];
  prompts: PromptDocument[];
  guides: Guide[];
};

type CacheEntry = {
  etag: string;
  body: string;
};

export type ContentResolveOptions = {
  offline?: boolean;
  contentDir?: string;
  contentApi?: string;
  cacheDir?: string;
  fetch?: typeof fetch;
};

function defaultCacheDir(): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "promptmarket");
  }
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA ?? os.homedir();
    return path.join(base, "promptmarket");
  }
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache");
  return path.join(base, "promptmarket");
}

function bundledContent(): ResolvedContent {
  const contentDir = resolveContentDir();
  const catalog = loadContentCatalog({ contentDir });
  const meta = contentMeta(catalog, contentDir);
  return {
    catalog,
    source: "offline",
    version: meta.contentVersion,
    updatedAt: meta.updatedAt,
  };
}

function cacheFile(cacheDir: string, api: string): string {
  const key = createHash("sha256").update(api).digest("hex").slice(0, 16);
  return path.join(cacheDir, `${key}.json`);
}

async function readCache(file: string): Promise<CacheEntry | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("etag" in parsed) ||
      !("body" in parsed)
    ) {
      return undefined;
    }
    const entry = parsed as CacheEntry;
    if (typeof entry.etag !== "string" || typeof entry.body !== "string") {
      return undefined;
    }
    return entry;
  } catch {
    return undefined;
  }
}

function catalogFromPayload(payload: CatalogPayload): ResolvedContent {
  return {
    catalog: createContentCatalog(
      payload.topics,
      payload.prompts,
      payload.guides,
    ),
    source: "hosted",
    version: payload.contentVersion ?? "unknown",
    updatedAt: payload.updatedAt ?? "unknown",
  };
}

function parsePayload(body: string): CatalogPayload {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Content catalog response was not an object");
  }
  const record = parsed as CatalogPayload;
  if (
    !Array.isArray(record.topics) ||
    !Array.isArray(record.prompts) ||
    !Array.isArray(record.guides)
  ) {
    throw new Error("Content catalog response is missing documents");
  }
  return record;
}

export async function resolveContent(
  options: ContentResolveOptions = {},
): Promise<ResolvedContent> {
  if (options.contentDir) {
    const contentDir = resolveContentDir({ contentDir: options.contentDir });
    const catalog = loadContentCatalog({ contentDir });
    const meta = contentMeta(catalog, contentDir);
    return {
      catalog,
      source: "directory",
      version: meta.contentVersion,
      updatedAt: meta.updatedAt,
    };
  }
  if (options.offline) {
    return bundledContent();
  }

  const api = (options.contentApi ?? DEFAULT_CONTENT_API).replace(/\/$/, "");
  const cacheDir = options.cacheDir ?? defaultCacheDir();
  const file = cacheFile(cacheDir, api);
  const cached = await readCache(file);
  const fetchImpl = options.fetch ?? fetch;
  try {
    const response = await fetchImpl(`${api}/catalog`, {
      headers: cached ? { "if-none-match": `"${cached.etag}"` } : {},
      signal: AbortSignal.timeout(4000),
    });
    if (response.status === 304 && cached) {
      const resolved = catalogFromPayload(parsePayload(cached.body));
      return { ...resolved, source: "cache" };
    }
    if (!response.ok) {
      throw new Error(`Content API returned ${response.status}`);
    }
    const body = await response.text();
    const etag = (response.headers.get("etag") ?? "").replaceAll('"', "");
    const payload = parsePayload(body);
    const version = etag || payload.contentVersion || "unknown";
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      file,
      JSON.stringify({ etag: version, body }),
      "utf8",
    );
    const resolved = catalogFromPayload({ ...payload, contentVersion: version });
    return resolved;
  } catch {
    if (cached) {
      try {
        const resolved = catalogFromPayload(parsePayload(cached.body));
        return { ...resolved, source: "cache" };
      } catch {
        return bundledContent();
      }
    }
    return bundledContent();
  }
}
