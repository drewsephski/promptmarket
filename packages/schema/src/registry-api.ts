import { z } from "zod";
import { IntegritySchema } from "./integrity.js";
import { AgentCompatibilitySchema, RecipeAuthorSchema } from "./recipe.js";
import { SemVerSchema } from "./semver.js";
import { SkillDocumentSchema, SkillNameSchema } from "./skill.js";

export const RecipeSummarySchema = z
  .object({
    name: SkillNameSchema,
    version: SemVerSchema,
    description: z.string(),
    tags: z.array(z.string()),
    compatibility: z.array(AgentCompatibilitySchema),
  })
  .strict();

export const RecipeListResponseSchema = z
  .object({
    recipes: z.array(RecipeSummarySchema),
  })
  .strict();

export const RecipeDetailSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: SkillNameSchema,
    version: SemVerSchema,
    description: z.string().min(1).max(1024),
    author: RecipeAuthorSchema,
    compatibility: z.array(AgentCompatibilitySchema),
    requires: z
      .object({
        mcp: z.array(z.string()),
      })
      .strict(),
    capabilities: z
      .object({
        filesystem: z.enum(["none", "read", "write"]),
        network: z.array(z.string()),
        shell: z.boolean(),
      })
      .strict(),
    entrypoint: z.literal("SKILL.md"),
    tags: z.array(z.string()),
    integrity: IntegritySchema,
    skill: SkillDocumentSchema,
  })
  .strict();

export const RecipePackageFileSchema = z.discriminatedUnion("encoding", [
  z
    .object({
      path: z.string().min(1),
      encoding: z.literal("utf8"),
      content: z.string(),
    })
    .strict(),
  z
    .object({
      path: z.string().min(1),
      encoding: z.literal("base64"),
      content: z.string(),
    })
    .strict(),
]);

export const RecipePackageResponseSchema = z
  .object({
    name: SkillNameSchema,
    version: SemVerSchema,
    integrity: IntegritySchema,
    files: z.array(RecipePackageFileSchema),
  })
  .strict();

export const RecipeVersionSummarySchema = z
  .object({
    version: SemVerSchema,
    integrity: IntegritySchema,
  })
  .strict();

export const RecipeVersionListResponseSchema = z
  .object({
    name: SkillNameSchema,
    latest: SemVerSchema,
    versions: z.array(RecipeVersionSummarySchema),
  })
  .strict()
  .superRefine(function validateVersionList(value, ctx) {
    const seen = new Set<string>();
    for (const item of value.versions) {
      if (seen.has(item.version)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate version ${item.version}`,
        });
      }
      seen.add(item.version);
    }
    if (!seen.has(value.latest)) {
      ctx.addIssue({
        code: "custom",
        message: "latest is not listed in versions",
      });
    }
  });

export const RegistryErrorSchema = z
  .object({
    error: z.string(),
  })
  .strict();

export type RecipeSummary = z.infer<typeof RecipeSummarySchema>;
export type RecipeListResponse = z.infer<typeof RecipeListResponseSchema>;
export type RecipeDetail = z.infer<typeof RecipeDetailSchema>;
export type RecipePackageFileResponse = z.infer<typeof RecipePackageFileSchema>;
export type RecipePackageResponse = z.infer<typeof RecipePackageResponseSchema>;
export type RecipeVersionSummary = z.infer<typeof RecipeVersionSummarySchema>;
export type RecipeVersionListResponse = z.infer<
  typeof RecipeVersionListResponseSchema
>;
