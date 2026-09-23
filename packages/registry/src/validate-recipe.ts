import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { SemVerSchema } from "@promptmarket/schema";
import { parseManifestText } from "./parse-manifest.js";
import { parseSkillText } from "./parse-skill.js";
import type { RecipeIssue, RecipeValidation } from "./types.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

export function validateRecipeTexts(
  directoryName: string,
  manifestText: string | undefined,
  skillText: string | undefined,
  options?: { versionDirectory?: string },
): RecipeValidation {
  const errors: RecipeIssue[] = [];

  if (manifestText === undefined) {
    errors.push({
      code: "manifest_missing",
      path: "promptmarket.yaml",
      message: "promptmarket.yaml is missing",
    });
  }

  if (skillText === undefined) {
    errors.push({
      code: "skill_missing",
      path: "SKILL.md",
      message: "SKILL.md is missing",
    });
  }

  if (manifestText === undefined || skillText === undefined) {
    return { ok: false, errors };
  }

  const manifestResult = parseManifestText(manifestText);
  const skillResult = parseSkillText(skillText);

  if (!manifestResult.ok) {
    errors.push(...manifestResult.errors);
  }
  if (!skillResult.ok) {
    errors.push(...skillResult.errors);
  }
  if (!manifestResult.ok || !skillResult.ok) {
    return { ok: false, errors };
  }

  if (options?.versionDirectory) {
    if (directoryName !== manifestResult.manifest.name) {
      errors.push({
        code: "name_mismatch",
        path: "name",
        message: `Recipe directory "${directoryName}" does not match manifest name "${manifestResult.manifest.name}"`,
      });
    }
    if (options.versionDirectory !== manifestResult.manifest.version) {
      errors.push({
        code: "version_mismatch",
        path: "version",
        message: `Version directory "${options.versionDirectory}" does not match manifest version "${manifestResult.manifest.version}"`,
      });
    }
  } else if (directoryName !== manifestResult.manifest.name) {
    errors.push({
      code: "name_mismatch",
      path: "name",
      message: `Directory name "${directoryName}" does not match manifest name "${manifestResult.manifest.name}"`,
    });
  }

  if (manifestResult.manifest.name !== skillResult.skill.name) {
    errors.push({
      code: "name_mismatch",
      path: "name",
      message: `Manifest name "${manifestResult.manifest.name}" does not match SKILL.md name "${skillResult.skill.name}"`,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    recipe: {
      manifest: manifestResult.manifest,
      skill: skillResult.skill,
    },
  };
}

export async function validateRecipe(
  recipePath: string,
): Promise<RecipeValidation> {
  const resolved = path.resolve(recipePath);
  const manifestPath = path.join(resolved, "promptmarket.yaml");
  const skillPath = path.join(resolved, "SKILL.md");
  const manifestText = (await fileExists(manifestPath))
    ? await readFile(manifestPath, "utf8")
    : undefined;
  const skillText = (await fileExists(skillPath))
    ? await readFile(skillPath, "utf8")
    : undefined;
  const directoryName = path.basename(resolved);
  if (SemVerSchema.safeParse(directoryName).success) {
    return validateRecipeTexts(
      path.basename(path.dirname(resolved)),
      manifestText,
      skillText,
      { versionDirectory: directoryName },
    );
  }
  return validateRecipeTexts(directoryName, manifestText, skillText);
}
