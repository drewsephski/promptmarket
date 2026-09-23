import { z } from "zod";
import { SemVerSchema } from "./semver.js";
import { SkillNameSchema } from "./skill.js";

export class InvalidRecipeReferenceError extends Error {
  readonly reference: string;

  constructor(reference: string) {
    super(`Invalid recipe reference: ${reference}`);
    this.name = "InvalidRecipeReferenceError";
    this.reference = reference;
  }
}

export const RecipeRefSchema = z
  .object({
    name: SkillNameSchema,
    version: SemVerSchema.optional(),
  })
  .strict();

export type RecipeRef = z.infer<typeof RecipeRefSchema>;

const RECIPE_REF_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:@([^@\s]+))?$/;

export function parseRecipeRef(input: string): RecipeRef {
  const match = RECIPE_REF_PATTERN.exec(input);
  const name = match?.[1];
  if (!name) {
    throw new InvalidRecipeReferenceError(input);
  }
  const version = match[2];
  const parsed = RecipeRefSchema.safeParse(
    version === undefined ? { name } : { name, version },
  );
  if (!parsed.success) {
    throw new InvalidRecipeReferenceError(input);
  }
  return parsed.data;
}
