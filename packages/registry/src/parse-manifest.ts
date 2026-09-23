import { readFile } from "node:fs/promises";
import {
  RecipeManifestSchema,
  type RecipeManifest,
} from "@promptmarket/schema";
import { parse } from "yaml";
import { issuesFromZod } from "./issues.js";
import type { RecipeIssue } from "./types.js";

export type ParseManifestResult =
  | { ok: true; manifest: RecipeManifest }
  | { ok: false; errors: RecipeIssue[] };

export function parseManifestText(text: string): ParseManifestResult {
  let parsed: unknown;
  try {
    parsed = parse(text, { schema: "core" });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to parse promptmarket.yaml";
    return {
      ok: false,
      errors: [
        {
          code: "manifest_parse_error",
          path: "promptmarket.yaml",
          message,
        },
      ],
    };
  }

  const result = RecipeManifestSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      errors: issuesFromZod(result.error, "manifest_invalid"),
    };
  }

  return { ok: true, manifest: result.data };
}

export async function parseManifestFile(
  filePath: string,
): Promise<ParseManifestResult> {
  const text = await readFile(filePath, "utf8");
  return parseManifestText(text);
}
