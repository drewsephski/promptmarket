import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import {
  RecipeNotFoundError,
  type Recipe,
  type RecipeSummary,
  type Registry,
} from "@promptmarket/registry";
import { afterEach, describe, expect, test } from "vitest";
import { createPromptMarketServer } from "../src/server.js";

const recipe: Recipe = {
  manifest: {
    schemaVersion: 1,
    name: "github-pr-review",
    version: "0.1.0",
    author: { name: "PromptMarket" },
    compatibility: ["cursor", "claude-code", "codex", "generic"],
    requires: { mcp: ["io.github.github/github-mcp-server"] },
    capabilities: {
      filesystem: "read",
      network: ["github.com"],
      shell: false,
    },
    entrypoint: "SKILL.md",
    tags: ["github", "pull-request", "code-review"],
  },
  skill: {
    name: "github-pr-review",
    description:
      "Review GitHub pull requests for correctness, regressions, security issues, maintainability, and missing tests.",
    body: "# GitHub Pull Request Review\n",
  },
};

function summaryOf(item: Recipe): RecipeSummary {
  return {
    name: item.manifest.name,
    version: item.manifest.version,
    description: item.skill.description,
    tags: item.manifest.tags,
    compatibility: item.manifest.compatibility,
  };
}

function registryWith(recipes: Recipe[]): Registry {
  return {
    source: { type: "file" },
    async list() {
      return recipes.map(summaryOf);
    },
    async get(name: string) {
      const found = recipes.find(function matchesName(item) {
        return item.manifest.name === name;
      });
      if (!found) {
        throw new RecipeNotFoundError(name);
      }
      return found;
    },
    async search(query: string) {
      const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .filter(function nonEmpty(token) {
          return token.length > 0;
        });
      return recipes
        .filter(function matchesQuery(item) {
          const haystack = [
            item.manifest.name,
            item.skill.description,
            ...item.manifest.tags,
          ]
            .join("\n")
            .toLowerCase();
          return tokens.every(function tokenInHaystack(token) {
            return haystack.includes(token);
          });
        })
        .map(summaryOf);
    },
    async fetchPackage(name: string) {
      const found = await this.get(name);
      return {
        recipe: found,
        files: [],
        integrity: "sha256-eA==",
      };
    },
  };
}

type ToolResult = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
};

describe("promptmarket mcp", function promptmarketMcp() {
  const clients: Client[] = [];

  afterEach(async function closeClients() {
    await Promise.all(
      clients.splice(0).map(function closeClient(client) {
        return client.close();
      }),
    );
  });

  async function connect(registry: Registry): Promise<Client> {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = createPromptMarketServer(registry);
    const client = new Client({ name: "promptmarket-test", version: "0.0.1" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    clients.push(client);
    return client;
  }

  test("advertises three read-only tools", async function advertisesTools() {
    const client = await connect(registryWith([recipe]));
    const listed = await client.listTools();
    const tools = listed.tools.map(function summarize(tool) {
      return {
        name: tool.name,
        readOnlyHint: tool.annotations?.readOnlyHint,
        destructiveHint: tool.annotations?.destructiveHint,
      };
    });

    expect(tools).toEqual([
      {
        name: "search_recipes",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "inspect_recipe",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "get_recipe",
        readOnlyHint: true,
        destructiveHint: false,
      },
    ]);
  });

  test("search_recipes returns matching summaries", async function searchesRecipes() {
    const client = await connect(registryWith([recipe]));
    const result = (await client.callTool({
      name: "search_recipes",
      arguments: { query: "review a pull request" },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      recipes: [
        {
          name: "github-pr-review",
          version: "0.1.0",
          description: recipe.skill.description,
          tags: ["github", "pull-request", "code-review"],
        },
      ],
    });
  });

  test("inspect_recipe returns requirements without the skill body", async function inspectsRecipe() {
    const client = await connect(registryWith([recipe]));
    const result = (await client.callTool({
      name: "inspect_recipe",
      arguments: { name: "github-pr-review" },
    })) as ToolResult;

    expect(result.structuredContent).toEqual({
      name: "github-pr-review",
      version: "0.1.0",
      description: recipe.skill.description,
      author: { name: "PromptMarket" },
      compatibility: ["cursor", "claude-code", "codex", "generic"],
      requires: { mcp: ["io.github.github/github-mcp-server"] },
      capabilities: {
        filesystem: "read",
        network: ["github.com"],
        shell: false,
      },
      tags: ["github", "pull-request", "code-review"],
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain(
      "# GitHub Pull Request Review",
    );
  });

  test("get_recipe returns the skill procedure", async function getsRecipe() {
    const client = await connect(registryWith([recipe]));
    const result = (await client.callTool({
      name: "get_recipe",
      arguments: { name: "github-pr-review" },
    })) as ToolResult;

    expect(result.structuredContent).toEqual({
      name: "github-pr-review",
      version: "0.1.0",
      skill: {
        name: "github-pr-review",
        description: recipe.skill.description,
        body: "# GitHub Pull Request Review\n",
      },
    });
  });

  test("search_recipes treats an empty query as every recipe", async function listsOnEmptyQuery() {
    const client = await connect(registryWith([recipe]));
    const result = (await client.callTool({
      name: "search_recipes",
      arguments: { query: "" },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      recipes: [{ name: "github-pr-review" }],
    });
  });

  test("get_recipe reports a missing recipe without failing the server", async function reportsMissingRecipe() {
    const client = await connect(registryWith([]));
    const result = (await client.callTool({
      name: "get_recipe",
      arguments: { name: "missing-recipe" },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toContain("missing-recipe");
  });
});
