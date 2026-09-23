import type { McpServer } from "@modelcontextprotocol/server";
import type { Registry } from "@promptmarket/registry";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  query: z.string(),
});

const outputSchema = z.object({
  recipes: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
    }),
  ),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerSearchRecipes(
  server: McpServer,
  registry: Registry,
): void {
  server.registerTool(
    "search_recipes",
    {
      title: "Search recipes",
      description:
        "Search PromptMarket recipes by name, description, and tags. Returns summaries, not full instructions.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleSearchRecipes(args) {
      try {
        const recipes = await registry.search(args.query);
        return toolResult({
          recipes: recipes.map(function summarize(recipe) {
            return {
              name: recipe.manifest.name,
              version: recipe.manifest.version,
              description: recipe.skill.description,
              tags: recipe.manifest.tags,
            };
          }),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
