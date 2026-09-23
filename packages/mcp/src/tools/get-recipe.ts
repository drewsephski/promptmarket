import type { McpServer } from "@modelcontextprotocol/server";
import type { Registry } from "@promptmarket/registry";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  name: z.string(),
  version: z
    .string()
    .optional()
    .describe("Exact recipe version. Omit to resolve the latest version."),
});

const outputSchema = z.object({
  name: z.string(),
  version: z.string(),
  skill: z.object({
    name: z.string(),
    description: z.string(),
    body: z.string(),
  }),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerGetRecipe(server: McpServer, registry: Registry): void {
  server.registerTool(
    "get_recipe",
    {
      title: "Get recipe",
      description:
        "Load a recipe's agent procedure, including the SKILL.md instructions.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleGetRecipe(args) {
      try {
        const recipe = await registry.get(args.name, args.version);
        return toolResult({
          name: recipe.manifest.name,
          version: recipe.manifest.version,
          skill: {
            name: recipe.skill.name,
            description: recipe.skill.description,
            body: recipe.skill.body,
          },
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
