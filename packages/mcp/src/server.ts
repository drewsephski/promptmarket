import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadContentCatalog, type ContentCatalog } from "@promptmarket/content";
import { FileRegistry, type Registry } from "@promptmarket/registry";
import { registerBuildContext } from "./tools/build-context.js";
import { registerBuildPlan } from "./tools/build-plan.js";
import { registerGetGuide } from "./tools/get-guide.js";
import { registerGetLearnTopic } from "./tools/get-learn-topic.js";
import { registerGetPrompt } from "./tools/get-prompt.js";
import { registerGetRecipe } from "./tools/get-recipe.js";
import { registerInspectRecipe } from "./tools/inspect-recipe.js";
import { registerListRecipeVersions } from "./tools/list-recipe-versions.js";
import { registerRecommendPrompt } from "./tools/recommend-prompt.js";
import { registerSearchGuides } from "./tools/search-guides.js";
import { registerSearchLearn } from "./tools/search-learn.js";
import { registerSearchPrompts } from "./tools/search-prompts.js";
import { registerSearchRecipes } from "./tools/search-recipes.js";

export function createPromptMarketServer(
  registry: Registry,
  catalog: ContentCatalog = loadContentCatalog(),
): McpServer {
  const server = new McpServer({
    name: "promptmarket",
    version: "0.4.0",
  });
  registerBuildContext(server, registry, catalog);
  registerBuildPlan(server, catalog);
  registerSearchPrompts(server, catalog);
  registerGetPrompt(server, catalog);
  registerSearchLearn(server, catalog);
  registerGetLearnTopic(server, catalog);
  registerSearchGuides(server, catalog);
  registerGetGuide(server, catalog);
  registerRecommendPrompt(server, catalog);
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
