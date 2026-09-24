import type { McpServer } from "@modelcontextprotocol/server";
import { loadContentCatalog, type ContentCatalog } from "@promptmarket/content";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  query: z
    .string()
    .describe(
      "Search text for a concept, such as RAG, evals, or structured outputs.",
    ),
});

const outputSchema = z.object({
  topics: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      summary: z.string(),
    }),
  ),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerSearchLearn(
  server: McpServer,
  catalog: ContentCatalog = loadContentCatalog(),
): void {
  server.registerTool(
    "search_learn",
    {
      title: "Search lessons",
      description:
        "Discovery fallback when you are browsing lessons rather than implementing a feature. Returns matching concepts, not full articles.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleSearchLearn(args) {
      try {
        const topics = catalog.searchTopics(args.query);
        return toolResult({
          topics: topics.map(function summarize(topic) {
            return {
              slug: topic.slug,
              title: topic.title,
              summary: topic.summary,
            };
          }),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
