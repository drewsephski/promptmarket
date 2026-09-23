import { z } from "zod";
import { SkillNameSchema } from "./skill.js";

export const RecipeManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: SkillNameSchema,
    version: z.string().min(1),
    author: z.object({
      name: z.string().min(1),
      url: z.url().optional(),
    }),
    compatibility: z
      .array(
        z.enum(["cursor", "claude-code", "codex", "github-copilot", "generic"]),
      )
      .default(["generic"]),
    requires: z
      .object({
        mcp: z.array(z.string()).default([]),
      })
      .default({ mcp: [] }),
    capabilities: z
      .object({
        filesystem: z.enum(["none", "read", "write"]).default("none"),
        network: z.array(z.string()).default([]),
        shell: z.boolean().default(false),
      })
      .default({
        filesystem: "none",
        network: [],
        shell: false,
      }),
    entrypoint: z.literal("SKILL.md").default("SKILL.md"),
    tags: z.array(z.string()).default([]),
  })
  .strict();

export type RecipeManifest = z.infer<typeof RecipeManifestSchema>;
