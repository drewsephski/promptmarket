import type { McpServer } from "@modelcontextprotocol/server";
import { loadContentCatalog, type ContentCatalog } from "@promptmarket/content";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  slug: z.string().describe("Lesson slug, such as rag or evals."),
});

const outputSchema = z.object({
  slug: z.string(),
  title: z.string(),
  definition: z.string(),
  mentalModel: z.string(),
  whenToUse: z.array(z.string()),
  whenNotToUse: z.array(z.string()),
  example: z.string(),
  implementationNotes: z.string(),
  commonMistakes: z.string(),
  relatedPrompts: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      description: z.string(),
    }),
  ),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerGetLearnTopic(
  server: McpServer,
  catalog: ContentCatalog = loadContentCatalog(),
): void {
  server.registerTool(
    "get_learn_topic",
    {
      title: "Get lesson",
      description:
        "Return one PromptMarket lesson: the definition, when to use it, a short example, and the prompts that go with it.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleGetLearnTopic(args) {
      try {
        const topic = catalog.getTopic(args.slug);
        return toolResult({
          slug: topic.slug,
          title: topic.title,
          definition: topic.definition,
          mentalModel: topic.mentalModel,
          whenToUse: topic.whenToUse,
          whenNotToUse: topic.whenNotToUse,
          example: topic.sections.example,
          implementationNotes: topic.sections.implementationNotes,
          commonMistakes: topic.sections.commonMistakes,
          relatedPrompts: topic.relatedPrompts.map(function related(name) {
            const prompt = catalog.getPrompt(name);
            return {
              name: prompt.slug,
              title: prompt.title,
              description: prompt.description,
            };
          }),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
