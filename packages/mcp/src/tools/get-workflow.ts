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

const inputSchema = z.object({
  query: z
    .string()
    .describe(
      "The feature to implement, such as adding RAG over internal documentation.",
    ),
  project: projectSchema.describe(
    "Project fingerprint. Do not send source files or environment variables.",
  ),
});

const outputSchema = z.object({
  context: z.unknown(),
  plan: z.unknown(),
  documentationTargets: z.array(z.unknown()),
  debugTargets: z.array(z.unknown()),
  evalTargets: z.array(z.unknown()),
  observabilityTargets: z.array(z.unknown()),
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
        "One read of the PromptMarket decision for an AI feature: context, plan, documentation targets, debug targets, eval targets, and observability targets. Does not call Context7, Promptfoo, or Langfuse, and does not edit code.",
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
        return toolResult({
          context,
          plan,
          documentationTargets: plan.documentationTargets,
          debugTargets: plan.debugTargets,
          evalTargets: plan.evalTargets,
          observabilityTargets: plan.observabilityTargets,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
