import type { McpServer } from "@modelcontextprotocol/server";
import {
  buildContext,
  buildPlan,
  loadContentCatalog,
  parseProjectContext,
  type ContentCatalog,
  type ProjectContext,
} from "@promptmarket/content";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const projectSchema = z
  .object({
    framework: z.string().optional(),
    language: z.string().optional(),
    packageManager: z.string().optional(),
    packages: z.array(z.string()).optional(),
    versions: z.record(z.string(), z.string()).optional(),
    ai: z
      .object({
        sdk: z.string().optional(),
        provider: z.string().optional(),
      })
      .optional(),
    database: z.array(z.string()).optional(),
    orm: z.array(z.string()).optional(),
  })
  .optional();

const featureSchema = z
  .object({
    id: z.string(),
    goal: z.string(),
    pattern: z.string().optional(),
    guide: z.string().optional(),
    prompt: z.string().optional(),
    catalog: z
      .object({
        version: z.string().optional(),
        guideVerifiedAt: z.string().optional(),
      })
      .optional(),
    implementation: z
      .object({
        paths: z.array(z.string()),
      })
      .optional(),
  })
  .optional()
  .describe(
    "Feature contract read from .promptmarket/features/*.yaml. The server does not read the repository.",
  );

const inputSchema = z.object({
  query: z
    .string()
    .describe(
      "The feature to implement, such as adding RAG over internal documentation.",
    ),
  project: projectSchema.describe(
    "Project fingerprint. Do not send source files or environment variables.",
  ),
  feature: featureSchema,
});

const outputSchema = z.object({
  context: z.unknown(),
  plan: z.unknown(),
  documentationTargets: z.array(z.unknown()),
  debugTargets: z.array(z.unknown()),
  evalTargets: z.array(z.unknown()),
  observabilityTargets: z.array(z.unknown()),
  reconciliation: z.unknown().optional(),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerGetWorkflow(
  server: McpServer,
  catalog: ContentCatalog = loadContentCatalog(),
): void {
  server.registerTool(
    "get_workflow",
    {
      title: "Get workflow",
      description:
        "One read of the PromptMarket decision for an AI feature: context, plan, documentation targets, debug targets, eval targets, and observability targets. Pass a feature contract when the repository already has .promptmarket/features. Does not read the repository, call Context7, Promptfoo, or Langfuse, or edit code.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleGetWorkflow(args) {
      try {
        const project = args.project
          ? parseProjectContext(args.project)
          : undefined;
        const resolved = project as ProjectContext | undefined;
        const context = buildContext(catalog, {
          query: args.query,
          project: resolved,
          detail: "compact",
          maxItems: 4,
        });
        const plan = buildPlan(catalog, {
          query: args.query,
          project: resolved,
        });
        const feature = args.feature;
        const reconciliation = feature
          ? {
              id: feature.id,
              goal: feature.goal,
              sameGuide: feature.guide === plan.guide?.slug,
              samePrompt: feature.prompt === plan.prompt?.name,
              contractGuide: feature.guide ?? null,
              planGuide: plan.guide?.slug ?? null,
              contractPrompt: feature.prompt ?? null,
              planPrompt: plan.prompt?.name ?? null,
              contractVerifiedAt: feature.catalog?.guideVerifiedAt ?? null,
              planVerifiedAt: plan.guide?.verifiedAt ?? null,
              guideMoved:
                Boolean(feature.catalog?.guideVerifiedAt) &&
                feature.catalog?.guideVerifiedAt !== plan.guide?.verifiedAt,
            }
          : undefined;
        return toolResult({
          context,
          plan,
          documentationTargets: plan.documentationTargets,
          debugTargets: plan.debugTargets,
          evalTargets: plan.evalTargets,
          observabilityTargets: plan.observabilityTargets,
          ...(reconciliation ? { reconciliation } : {}),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
