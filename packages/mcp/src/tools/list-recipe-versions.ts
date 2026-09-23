import type { McpServer } from "@modelcontextprotocol/server";
import type { Registry } from "@promptmarket/registry";
import { z } from "zod";
import { toolError, toolResult } from "../tool-result.js";

const inputSchema = z.object({
  name: z.string().describe("Recipe name, without a version."),
});

const outputSchema = z.object({
  name: z.string(),
  latest: z.string(),
  versions: z.array(
    z.object({
      version: z.string(),
      integrity: z.string(),
    }),
  ),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

export function registerListRecipeVersions(
  server: McpServer,
  registry: Registry,
): void {
  server.registerTool(
    "list_recipe_versions",
    {
      title: "List recipe versions",
      description:
        "List immutable versions of a recipe. Returns version numbers and integrity hashes, not SKILL.md bodies.",
      inputSchema,
      outputSchema,
      annotations,
    },
    async function handleListRecipeVersions(args) {
      try {
        const listed = await registry.listVersions(args.name);
        return toolResult({
          name: listed.name,
          latest: listed.latest,
          versions: listed.versions.map(function summarize(version) {
            return {
              version: version.version,
              integrity: version.integrity,
            };
          }),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
