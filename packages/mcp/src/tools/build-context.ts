import type { McpServer } from "@modelcontextprotocol/server";
import {
  buildContext,
  loadContentCatalog,
  type ContentCatalog,
  type ContextDetail,
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
      "compact returns the concept, prompt body, and relevant guide sections. full adds the rest of each document.",
    ),
});

const topicSchema = z.object({
  slug: z.string(),
  title: z.string(),
  definition: z.string(),
  mentalModel: z.string(),
  commonMistake: z.string(),
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
  body: z.string(),
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

const outputSchema = z.object({
  query: z.string(),
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
        "Assemble the lessons, prompts, guides, and skills for a feature in one call. Deterministic lexical ranking plus the catalog graph. Does not call a model. Use this before implementing an AI feature.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleBuildContext(args) {
      try {
        const recipes = await registry.search(args.query);
        const context = buildContext(catalog, {
          query: args.query,
          maxItems: args.maxItems,
          detail: args.detail as ContextDetail | undefined,
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
