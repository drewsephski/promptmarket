import { readFile } from "node:fs/promises";
import { SkillFrontmatterSchema } from "@promptmarket/schema";
import { parse } from "yaml";
import { issuesFromZod } from "./issues.js";
import type { RecipeIssue, SkillDocument } from "./types.js";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;

export type ParseSkillResult =
  { ok: true; skill: SkillDocument } | { ok: false; errors: RecipeIssue[] };

export function parseSkillText(text: string): ParseSkillResult {
  const match = FRONTMATTER_PATTERN.exec(text);
  if (!match) {
    return {
      ok: false,
      errors: [
        {
          code: "frontmatter_missing",
          path: "SKILL.md",
          message: "SKILL.md is missing YAML frontmatter",
        },
      ],
    };
  }

  const frontmatter = match[1] ?? "";
  const body = match[2] ?? "";
  let parsed: unknown;
  try {
    parsed = parse(frontmatter, { schema: "core" });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to parse SKILL.md frontmatter";
    return {
      ok: false,
      errors: [
        {
          code: "skill_parse_error",
          path: "SKILL.md",
          message,
        },
      ],
    };
  }

  const result = SkillFrontmatterSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      errors: issuesFromZod(result.error, "skill_invalid"),
    };
  }

  return {
    ok: true,
    skill: {
      name: result.data.name,
      description: result.data.description,
      body,
    },
  };
}

export async function parseSkillFile(
  filePath: string,
): Promise<ParseSkillResult> {
  const text = await readFile(filePath, "utf8");
  return parseSkillText(text);
}
