import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { FileRegistry, type Registry } from "@promptmarket/registry";
import { registerGetRecipe } from "./tools/get-recipe.js";
import { registerInspectRecipe } from "./tools/inspect-recipe.js";
import { registerListRecipeVersions } from "./tools/list-recipe-versions.js";
import { registerSearchRecipes } from "./tools/search-recipes.js";

export function createPromptMarketServer(registry: Registry): McpServer {
  const server = new McpServer({
    name: "promptmarket",
    version: "0.2.0",
  });
  registerSearchRecipes(server, registry);
  registerInspectRecipe(server, registry);
  registerGetRecipe(server, registry);
  registerListRecipeVersions(server, registry);
  return server;
}

export function startStdio(registry: Registry = new FileRegistry()) {
  return serveStdio(function createServer() {
    return createPromptMarketServer(registry);
  });
}
