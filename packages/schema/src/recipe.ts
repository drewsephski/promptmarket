import { z } from "zod";

export const RecipeManifestSchema = z.object({
  schemaVersion: z.literal(1),

  name: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/),

  version: z.string(),

  description: z.string(),

  author: z.object({
    name: z.string(),
    url: z.string().url().optional(),
  }),

  compatibility: z
    .array(
      z.enum([
        "cursor",
        "claude-code",
        "codex",
        "github-copilot",
        "generic",
      ]),
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

  entrypoint: z.string().default("SKILL.md"),

  tags: z.array(z.string()).default([]),
});

export type RecipeManifest = z.infer<
  typeof RecipeManifestSchema
>;