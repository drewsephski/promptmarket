import type { McpServer } from "@modelcontextprotocol/server";
import { loadContentCatalog, type ContentCatalog } from "@promptmarket/content";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  task: z
    .string()
    .describe(
      "The job in plain language, such as extracting JSON from messy text.",
    ),
});

const summarySchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
});

const outputSchema = z.object({
  recommendation: summarySchema.nullable(),
  alternatives: z.array(summarySchema),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerRecommendPrompt(
  server: McpServer,
  catalog: ContentCatalog = loadContentCatalog(),
): void {
  server.registerTool(
    "recommend_prompt",
    {
      title: "Recommend a prompt",
      description:
        "Pick a prompt by matching the task against titles, categories, tags, and descriptions. Deterministic and lexical. If the match is weak, recommendation is null and alternatives lists the closest prompts. Does not call a model.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleRecommendPrompt(args) {
      try {
        const result = catalog.recommendPrompt(args.task);
        const compact = function pick(prompt: {
          name: string;
          title: string;
          description: string;
          category: string;
        }) {
          return {
            name: prompt.name,
            title: prompt.title,
            description: prompt.description,
            category: prompt.category,
          };
        };
        return toolResult({
          recommendation: result.recommendation
            ? compact(result.recommendation)
            : null,
          alternatives: result.alternatives.map(compact),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
