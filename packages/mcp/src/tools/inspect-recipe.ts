import type { McpServer } from "@modelcontextprotocol/server";
import type { Registry } from "@promptmarket/registry";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  name: z.string(),
});

const outputSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  requires: z.object({
    mcp: z.array(z.string()),
  }),
  capabilities: z.object({
    filesystem: z.enum(["none", "read", "write"]),
    network: z.array(z.string()),
    shell: z.boolean(),
  }),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerInspectRecipe(
  server: McpServer,
  registry: Registry,
): void {
  server.registerTool(
    "inspect_recipe",
    {
      title: "Inspect recipe",
      description:
        "Inspect a recipe's requirements and capabilities before loading its full instructions.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleInspectRecipe(args) {
      try {
        const recipe = await registry.get(args.name);
        return toolResult({
          name: recipe.manifest.name,
          version: recipe.manifest.version,
          description: recipe.skill.description,
          requires: recipe.manifest.requires,
          capabilities: recipe.manifest.capabilities,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
