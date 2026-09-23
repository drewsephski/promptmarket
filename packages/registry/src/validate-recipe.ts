import { stat } from "node:fs/promises";
import path from "node:path";
import { parseManifestFile } from "./parse-manifest.js";
import { parseSkillFile } from "./parse-skill.js";
import type { RecipeIssue, RecipeValidation } from "./types.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

export async function validateRecipe(
  recipePath: string,
): Promise<RecipeValidation> {
  const resolved = path.resolve(recipePath);
  const directoryName = path.basename(resolved);
  const manifestPath = path.join(resolved, "promptmarket.yaml");
  const skillPath = path.join(resolved, "SKILL.md");
  const errors: RecipeIssue[] = [];

  if (!(await fileExists(manifestPath))) {
    errors.push({
      code: "manifest_missing",
      path: "promptmarket.yaml",
      message: "promptmarket.yaml is missing",
    });
  }

  if (!(await fileExists(skillPath))) {
    errors.push({
      code: "skill_missing",
      path: "SKILL.md",
      message: "SKILL.md is missing",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const manifestResult = await parseManifestFile(manifestPath);
  const skillResult = await parseSkillFile(skillPath);

  if (!manifestResult.ok) {
    errors.push(...manifestResult.errors);
  }
  if (!skillResult.ok) {
    errors.push(...skillResult.errors);
  }
  if (!manifestResult.ok || !skillResult.ok) {
    return { ok: false, errors };
  }

  if (directoryName !== manifestResult.manifest.name) {
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
      path: resolved,
    },
  };
}
