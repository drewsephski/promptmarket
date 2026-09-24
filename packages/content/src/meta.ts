import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ContentCatalog } from "./load.js";

export type ContentMeta = {
  schemaVersion: 1;
  contentVersion: string;
  updatedAt: string;
  counts: {
    lessons: number;
    prompts: number;
    guides: number;
  };
};

function markdownFiles(directory: string): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const name of entries) {
    const full = path.join(directory, name);
    let isFile = false;
    try {
      isFile = statSync(full).isFile();
    } catch {
      isFile = false;
    }
    if (isFile && name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files.sort();
}

export function contentVersionOf(contentDir: string): string {
  const hash = createHash("sha256");
  for (const folder of ["learn", "prompts", "guides"]) {
    for (const file of markdownFiles(path.join(contentDir, folder))) {
      hash.update(path.relative(contentDir, file));
      hash.update("\0");
      hash.update(readFileSync(file));
      hash.update("\0");
    }
  }
  return hash.digest("hex").slice(0, 7);
}

export function contentMeta(
  catalog: ContentCatalog,
  contentDir: string,
): ContentMeta {
  const dates = catalog.guides.flatMap(function verified(guide) {
    return guide.verifiedAt ? [guide.verifiedAt] : [];
  });
  dates.sort();
  return {
    schemaVersion: 1,
    contentVersion: contentVersionOf(contentDir),
    updatedAt: dates[dates.length - 1] ?? "unknown",
    counts: {
      lessons: catalog.topics.length,
      prompts: catalog.prompts.length,
      guides: catalog.guides.length,
    },
  };
}
