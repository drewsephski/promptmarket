import type { McpServer } from "@modelcontextprotocol/server";
import { loadContentCatalog, type ContentCatalog } from "@promptmarket/content";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const SITE_ORIGIN = "https://promptmarket.sh";

const inputSchema = z.object({
  query: z
    .string()
    .describe(
      "Search text for a guide, such as structured outputs, Neon, or Drizzle.",
    ),
});

const outputSchema = z.object({
  guides: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      description: z.string(),
      difficulty: z.string(),
      stack: z.array(z.string()),
      concepts: z.array(z.string()),
      url: z.string(),
    }),
  ),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerSearchGuides(
  server: McpServer,
  catalog: ContentCatalog = loadContentCatalog(),
): void {
  server.registerTool(
    "search_guides",
    {
      title: "Search guides",
      description:
        "Search PromptMarket guides for full-stack AI tutorials. Returns compact metadata and a URL, not the full tutorial. An empty query returns every guide.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleSearchGuides(args) {
      try {
        const guides = catalog.searchGuides(args.query);
        return toolResult({
          guides: guides.map(function summarize(guide) {
            return {
              slug: guide.slug,
              title: guide.title,
              description: guide.description,
              difficulty: guide.difficulty,
              stack: guide.stack,
              concepts: guide.concepts,
              url: `${SITE_ORIGIN}${guide.href}`,
            };
          }),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
