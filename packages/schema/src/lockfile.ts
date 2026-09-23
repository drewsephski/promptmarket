import { z } from "zod";
import { IntegritySchema } from "./integrity.js";
import { RecipeSourceSchema } from "./source.js";
import { SemVerSchema } from "./semver.js";
import { SkillNameSchema } from "./skill.js";

export const LockfileEntrySchema = z
  .object({
    name: SkillNameSchema,
    version: SemVerSchema,
    source: RecipeSourceSchema,
    integrity: IntegritySchema,
  })
  .strict();

export const LockfileSchema = z
  .object({
    lockfileVersion: z.literal(1),
    recipes: z.record(z.string(), LockfileEntrySchema),
  })
  .strict();

export type LockfileEntry = z.infer<typeof LockfileEntrySchema>;
export type Lockfile = z.infer<typeof LockfileSchema>;
