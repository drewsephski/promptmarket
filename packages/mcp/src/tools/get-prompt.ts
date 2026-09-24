import type { McpServer } from "@modelcontextprotocol/server";
import { loadContentCatalog, type ContentCatalog } from "@promptmarket/content";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  name: z.string().describe("Prompt slug, such as structured-data-extractor."),
});

const outputSchema = z.object({
  title: z.string(),
  description: z.string(),
  prompt: z.string(),
  variables: z.array(z.string()),
  category: z.string(),
  relatedConcepts: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
    }),
  ),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerGetPrompt(
  server: McpServer,
  catalog: ContentCatalog = loadContentCatalog(),
): void {
  server.registerTool(
    "get_prompt",
    {
      title: "Get prompt",
      description:
        "Drill down after build_context when you need one prompt body, its placeholders, and the lessons that explain it.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleGetPrompt(args) {
      try {
        const prompt = catalog.getPrompt(args.name);
        return toolResult({
          title: prompt.title,
          description: prompt.description,
          prompt: prompt.body,
          variables: prompt.variables,
          category: prompt.category,
          relatedConcepts: prompt.relatedTopics.map(function concept(slug) {
            const topic = catalog.getTopic(slug);
            return { slug, title: topic.title };
          }),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
