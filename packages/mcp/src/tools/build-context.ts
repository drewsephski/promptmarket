import type { McpServer } from "@modelcontextprotocol/server";
import {
  buildContext,
  loadContentCatalog,
  parseProjectContext,
  type ContentCatalog,
  type ContextDetail,
  type ProjectContext,
} from "@promptmarket/content";
import type { Registry } from "@promptmarket/registry";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  query: z
    .string()
    .describe(
      "The feature in plain language, such as building RAG in Next.js with Neon.",
    ),
  maxItems: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Maximum items in each collection. Defaults to 5."),
  detail: z
    .enum(["compact", "full"])
    .optional()
    .describe(
      "compact returns one full concept, one prompt body, and one or two guide sections. Related items are summaries. full adds the rest of each document.",
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
      "If you know the current project's framework or dependencies, include them so results can be tailored to the existing stack. Do not send source files or environment variables.",
    ),
});

const topicSchema = z.object({
  slug: z.string(),
  title: z.string(),
  definition: z.string(),
  mentalModel: z.string().optional(),
  commonMistake: z.string().optional(),
  url: z.string(),
  summary: z.string().optional(),
  why: z.string().optional(),
  whenToUse: z.array(z.string()).optional(),
  whenNotToUse: z.array(z.string()).optional(),
  example: z.string().optional(),
  implementationNotes: z.string().optional(),
  relatedPrompts: z.array(z.string()).optional(),
  relatedTopics: z.array(z.string()).optional(),
});

const promptSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  variables: z.array(z.string()),
  body: z.string().optional(),
  url: z.string(),
  whenToUse: z.string().optional(),
  whyItWorks: z.string().optional(),
  commonMistakes: z.array(z.string()).optional(),
  exampleInput: z.string().optional(),
  exampleOutput: z.string().optional(),
  relatedTopics: z.array(z.string()).optional(),
  relatedPrompts: z.array(z.string()).optional(),
});

const guideSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  difficulty: z.string(),
  stack: z.array(z.string()),
  architecture: z.array(z.string()),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      markdown: z.string(),
    }),
  ),
  url: z.string(),
  concepts: z.array(z.string()).optional(),
  estimatedTime: z.string().optional(),
  verifiedAt: z.string().optional(),
  prerequisites: z.array(z.string()).optional(),
  whatYouBuild: z.array(z.string()).optional(),
  whatYouLearn: z.array(z.string()).optional(),
  relatedTopics: z.array(z.string()).optional(),
  relatedPrompts: z.array(z.string()).optional(),
});

const relatedSchema = z.object({
  kind: z.enum(["topic", "prompt", "guide"]),
  name: z.string(),
  title: z.string(),
  summary: z.string(),
  url: z.string(),
});

const outputSchema = z.object({
  query: z.string(),
  mode: z.enum(["build", "debug", "decide", "upgrade", "learn"]),
  topics: z.array(topicSchema),
  prompts: z.array(promptSchema),
  guides: z.array(guideSchema),
  skills: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
    }),
  ),
  suggestedNextSteps: z.array(
    z.object({
      kind: z.enum(["topic", "prompt", "guide", "skill", "query"]),
      name: z.string(),
      title: z.string(),
      reason: z.string(),
    }),
  ),
  primary: z
    .object({
      topic: z.string().optional(),
      prompt: z.string().optional(),
      guide: z.string().optional(),
    })
    .optional(),
  matches: z
    .array(
      z.object({
        kind: z.enum(["topic", "prompt", "guide"]),
        name: z.string(),
        reasons: z.array(z.string()),
      }),
    )
    .optional(),
  project: z.unknown().optional(),
  projectNotes: z
    .array(
      z.object({
        status: z.enum(["detected", "not-detected", "required"]),
        label: z.string(),
      }),
    )
    .optional(),
  related: z
    .object({
      topics: z.array(relatedSchema),
      prompts: z.array(relatedSchema),
      guides: z.array(relatedSchema),
    })
    .optional(),
  compatibility: z
    .array(
      z.object({
        packageName: z.string(),
        label: z.string(),
        status: z.enum(["match", "differs", "not-detected"]),
        tested: z.string(),
        detected: z.string().optional(),
      }),
    )
    .optional(),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerBuildContext(
  server: McpServer,
  registry: Registry,
  catalog: ContentCatalog = loadContentCatalog(),
): void {
  server.registerTool(
    "build_context",
    {
      title: "Build context",
      description:
        "Use this first when implementing or modifying an AI feature. Returns one primary lesson, prompt, and guide. Call get_learn_topic, get_prompt, or get_guide only when you need the rest of a related item. Deterministic ranking. Does not call a model. Include a project fingerprint when you know the framework or dependencies.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleBuildContext(args) {
      try {
        const recipes = await registry.search(args.query);
        const project = args.project
          ? parseProjectContext(args.project)
          : undefined;
        const context = buildContext(catalog, {
          query: args.query,
          maxItems: args.maxItems,
          detail: args.detail as ContextDetail | undefined,
          project: project as ProjectContext | undefined,
          skills: recipes.map(function skill(recipe) {
            return {
              name: recipe.name,
              version: recipe.version,
              description: recipe.description,
              tags: recipe.tags,
            };
          }),
        });
        return toolResult(context);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
