import { z } from "zod";
import { SemVerSchema } from "./semver.js";
import { SkillNameSchema } from "./skill.js";

export const AGENT_COMPATIBILITY = [
  "cursor",
  "claude-code",
  "codex",
  "opencode",
  "github-copilot",
  "generic",
] as const;

export const FILESYSTEM_CAPABILITIES = ["none", "read", "write"] as const;

export const AgentCompatibilitySchema = z.enum(AGENT_COMPATIBILITY);

export const RecipeAuthorSchema = z.object({
  name: z.string().min(1),
  url: z.url().optional(),
});

export const RecipeRequiresSchema = z
  .object({
    mcp: z.array(z.string()).default([]),
  })
  .default({ mcp: [] });

export const RecipeCapabilitiesSchema = z
  .object({
    filesystem: z.enum(FILESYSTEM_CAPABILITIES).default("none"),
    network: z.array(z.string()).default([]),
    shell: z.boolean().default(false),
  })
  .default({
    filesystem: "none",
    network: [],
    shell: false,
  });

export const RecipeManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: SkillNameSchema,
    version: SemVerSchema,
    author: RecipeAuthorSchema,
    compatibility: z.array(AgentCompatibilitySchema).default(["generic"]),
    requires: RecipeRequiresSchema,
    capabilities: RecipeCapabilitiesSchema,
    entrypoint: z.literal("SKILL.md").default("SKILL.md"),
    tags: z.array(z.string()).default([]),
  })
  .strict();

export type RecipeManifest = z.infer<typeof RecipeManifestSchema>;
