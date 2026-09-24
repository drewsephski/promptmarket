import type { McpServer } from "@modelcontextprotocol/server";
import {
  buildPlan,
  loadContentCatalog,
  parseProjectContext,
  type ContentCatalog,
  type ProjectContext,
} from "@promptmarket/content";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  query: z
    .string()
    .describe(
      "The feature to implement, such as adding RAG over internal documentation.",
    ),
  project: z
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
    .optional()
    .describe(
      "Project fingerprint so the plan can mark detected and missing pieces. Do not send source files or environment variables.",
    ),
});

const outputSchema = z.object({
  goal: z.string(),
  pattern: z.object({
    topic: z.string(),
    reason: z.string(),
  }),
  guide: z
    .object({
      slug: z.string(),
      title: z.string(),
      verifiedAt: z.string().optional(),
    })
    .optional(),
  architecture: z.array(z.string()),
  compatibility: z.array(
    z.object({
      packageName: z.string(),
      label: z.string(),
      status: z.enum(["match", "differs", "not-detected"]),
      tested: z.string(),
      detected: z.string().optional(),
    }),
  ),
  requirements: z.array(
    z.object({
      status: z.enum(["detected", "not-detected", "required"]),
      label: z.string(),
    }),
  ),
  steps: z.array(
    z.object({
      title: z.string(),
      guidance: z.string(),
      sourceSection: z.string().optional(),
    }),
  ),
  prompt: z
    .object({
      name: z.string(),
      title: z.string(),
      description: z.string(),
      category: z.string(),
      variables: z.array(z.string()),
      body: z.string().optional(),
      url: z.string(),
    })
    .optional(),
  verification: z.array(z.string()),
  references: z.array(
    z.object({
      kind: z.enum(["lesson", "prompt", "guide"]),
      name: z.string(),
      url: z.string(),
    }),
  ),
  evalTargets: z.array(
    z.object({
      system: z.literal("promptfoo"),
      kind: z.enum(["rag", "tool-calling", "structured-output"]),
      guide: z.string(),
      cases: z.array(
        z.object({
          name: z.string(),
          input: z.string(),
          expectation: z.union([z.string(), z.array(z.string())]),
        }),
      ),
    }),
  ),
  debugTargets: z.array(
    z.object({
      tool: z.literal("ai-sdk-devtools"),
      reason: z.string(),
      command: z.string(),
      warning: z.string(),
    }),
  ),
  documentationTargets: z.array(
    z.object({
      package: z.string(),
      library: z.string(),
      detectedVersion: z.string().optional(),
      testedLine: z.string().optional(),
      reason: z.string(),
    }),
  ),
  evidenceTargets: z.object({
    docs: z.array(
      z.object({
        package: z.string(),
        library: z.string(),
        detectedVersion: z.string().optional(),
        testedLine: z.string().optional(),
        reason: z.string(),
      }),
    ),
    references: z.array(
      z.object({
        type: z.literal("github"),
        repo: z.string(),
        reason: z.string(),
        url: z.string(),
      }),
    ),
  }),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerBuildPlan(
  server: McpServer,
  catalog: ContentCatalog = loadContentCatalog(),
): void {
  server.registerTool(
    "build_plan",
    {
      title: "Build plan",
      description:
        "After build_context, when the task is to implement an AI feature. Returns an architecture, implementation steps, a starting prompt, verification checks, documentation targets, eval targets, and debug targets. Does not call a model and does not edit code.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleBuildPlan(args) {
      try {
        const project = args.project
          ? parseProjectContext(args.project)
          : undefined;
        const plan = buildPlan(catalog, {
          query: args.query,
          project: project as ProjectContext | undefined,
        });
        return toolResult(plan);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
