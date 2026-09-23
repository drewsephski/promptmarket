import { createHash } from "node:crypto";
import type { RecipeFile } from "./types.js";

function comparePaths(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function digestFiles(files: RecipeFile[]): string {
  const sorted = [...files].sort(function byPath(left, right) {
    return comparePaths(left.path, right.path);
  });
  const hash = createHash("sha256");
  for (const file of sorted) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.contents);
    hash.update("\0");
  }
  return `sha256-${hash.digest("base64")}`;
}
