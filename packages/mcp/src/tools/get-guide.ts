import type { McpServer } from "@modelcontextprotocol/server";
import { loadContentCatalog, type ContentCatalog } from "@promptmarket/content";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const SITE_ORIGIN = "https://promptmarket.sh";

const inputSchema = z.object({
  slug: z.string().describe("Guide slug, such as ai-product-brief-builder."),
});

const outputSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  difficulty: z.string(),
  stack: z.array(z.string()),
  concepts: z.array(z.string()),
  estimatedTime: z.string().optional(),
  verifiedAt: z.string().optional(),
  prerequisites: z.array(z.string()),
  whatYouBuild: z.array(z.string()),
  whatYouLearn: z.array(z.string()),
  architecture: z.array(z.string()),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      markdown: z.string(),
    }),
  ),
  relatedTopics: z.array(z.string()),
  relatedPrompts: z.array(z.string()),
  url: z.string(),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerGetGuide(
  server: McpServer,
  catalog: ContentCatalog = loadContentCatalog(),
): void {
  server.registerTool(
    "get_guide",
    {
      title: "Get guide",
      description:
        "Return one PromptMarket guide as structured markdown sections. The payload is the tutorial text, not HTML.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleGetGuide(args) {
      try {
        const guide = catalog.getGuide(args.slug);
        return toolResult({
          slug: guide.slug,
          title: guide.title,
          description: guide.description,
          difficulty: guide.difficulty,
          stack: guide.stack,
          concepts: guide.concepts,
          ...(guide.estimatedTime
            ? { estimatedTime: guide.estimatedTime }
            : {}),
          ...(guide.verifiedAt ? { verifiedAt: guide.verifiedAt } : {}),
          prerequisites: guide.prerequisites,
          whatYouBuild: guide.whatYouBuild,
          whatYouLearn: guide.whatYouLearn,
          architecture: guide.architecture,
          sections: guide.sections.map(function section(item) {
            return {
              id: item.id,
              title: item.title,
              markdown: item.markdown,
            };
          }),
          relatedTopics: guide.relatedTopics,
          relatedPrompts: guide.relatedPrompts,
          url: `${SITE_ORIGIN}${guide.href}`,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
