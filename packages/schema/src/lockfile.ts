import { z } from "zod";
import { SemVerSchema } from "./semver.js";
import { SkillNameSchema } from "./skill.js";

export const LockfileEntrySchema = z
  .object({
    name: SkillNameSchema,
    version: SemVerSchema,
    source: z.string().min(1),
    integrity: z.string().regex(/^sha256-[A-Za-z0-9+/]+=*$/),
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
