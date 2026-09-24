import type { McpServer } from "@modelcontextprotocol/server";
import {
  loadContentCatalog,
  PROMPT_CATEGORIES,
  type ContentCatalog,
} from "@promptmarket/content";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  query: z
    .string()
    .describe(
      "Search text matched against title, description, category, tags, and related concepts.",
    ),
  category: z
    .string()
    .optional()
    .describe(`Optional category: ${PROMPT_CATEGORIES.join(", ")}.`),
});

const summarySchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
});

const outputSchema = z.object({
  prompts: z.array(summarySchema),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerSearchPrompts(
  server: McpServer,
  catalog: ContentCatalog = loadContentCatalog(),
): void {
  server.registerTool(
    "search_prompts",
    {
      title: "Search prompts",
      description:
        "Discovery fallback when you are browsing prompt patterns rather than implementing a feature. Returns summaries, not prompt bodies.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleSearchPrompts(args) {
      try {
        const prompts = catalog.searchPrompts(args.query, args.category);
        return toolResult({
          prompts: prompts.map(function summarize(prompt) {
            return {
              name: prompt.name,
              title: prompt.title,
              description: prompt.description,
              category: prompt.category,
              tags: prompt.tags,
            };
          }),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
