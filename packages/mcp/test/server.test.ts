import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import {
  RecipeNotFoundError,
  RecipeVersionNotFoundError,
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
    async get(name: string, version?: string) {
      const matches = recipes.filter(function matchesName(item) {
        return item.manifest.name === name;
      });
      const found = version
        ? matches.find(function matchesVersion(item) {
            return item.manifest.version === version;
          })
        : matches[matches.length - 1];
      if (!found) {
        if (version) {
          throw new RecipeVersionNotFoundError(name, version);
        }
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
    async fetchPackage(name: string, version?: string) {
      const found = await this.get(name, version);
      return {
        recipe: found,
        files: [],
        integrity: "sha256-eA==",
      };
    },
    async listVersions(name: string) {
      const matches = recipes.filter(function matchesName(item) {
        return item.manifest.name === name;
      });
      if (matches.length === 0) {
        throw new RecipeNotFoundError(name);
      }
      const versions = matches.map(function summarize(item) {
        return {
          version: item.manifest.version,
          integrity: `sha256-${item.manifest.version}`,
        };
      });
      const latest = versions[versions.length - 1];
      if (!latest) {
        throw new RecipeNotFoundError(name);
      }
      return {
        name,
        latest: latest.version,
        versions,
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

    expect(client.getInstructions()).toContain("prefer get_workflow");

    expect(tools).toEqual([
      {
        name: "build_context",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "build_plan",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "get_workflow",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "search_prompts",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "get_prompt",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "search_learn",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "get_learn_topic",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "search_guides",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "get_guide",
        readOnlyHint: true,
        destructiveHint: false,
      },
      {
        name: "recommend_prompt",
        readOnlyHint: true,
        destructiveHint: false,
      },
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
      {
        name: "list_recipe_versions",
        readOnlyHint: true,
        destructiveHint: false,
      },
    ]);
  });

  test("get_workflow returns the plan targets without calling other systems", async function getsWorkflow() {
    const client = await connect(registryWith([recipe]));
    const result = (await client.callTool({
      name: "get_workflow",
      arguments: {
        query: "Add RAG over internal documentation",
        project: {
          framework: "Next.js",
          packages: ["next", "ai"],
          versions: { ai: "7.0.0" },
          ai: { sdk: "Vercel AI SDK" },
        },
      },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    const body = result.structuredContent as {
      documentationTargets: Array<{ package: string }>;
      evalTargets: Array<{ system: string }>;
      observabilityTargets: Array<{ provider: string }>;
      debugTargets: Array<{ tool: string }>;
    };
    expect(body.documentationTargets.map(function packageOf(target) {
      return target.package;
    })).toContain("ai");
    expect(body.evalTargets[0]?.system).toBe("promptfoo");
    expect(body.debugTargets[0]?.tool).toBe("ai-sdk-devtools");
    expect(body.observabilityTargets[0]?.provider).toBe("langfuse");
  });

  test("get_workflow reconciles a passed feature contract", async function reconcilesFeature() {
    const client = await connect(registryWith([recipe]));
    const result = (await client.callTool({
      name: "get_workflow",
      arguments: {
        query: "Add RAG over internal documentation",
        feature: {
          id: "internal-docs-rag",
          goal: "Add RAG over internal documentation",
          guide: "rag-knowledge-base",
          prompt: "rag-grounded-answer",
          catalog: { guideVerifiedAt: "2000-01-01" },
        },
      },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    const body = result.structuredContent as {
      reconciliation: { id: string; sameGuide: boolean; guideMoved: boolean };
    };
    expect(body.reconciliation.id).toBe("internal-docs-rag");
    expect(body.reconciliation.sameGuide).toBe(true);
    expect(body.reconciliation.guideMoved).toBe(true);
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

  test("inspects and loads an exact version and lists versions without skill bodies", async function usesExactVersions() {
    const older: Recipe = {
      ...recipe,
      manifest: { ...recipe.manifest, version: "0.1.0" },
      skill: { ...recipe.skill, body: "# Historical\n" },
    };
    const newer: Recipe = {
      ...recipe,
      manifest: { ...recipe.manifest, version: "0.2.0" },
      skill: { ...recipe.skill, body: "# Current\n" },
    };
    const client = await connect(registryWith([older, newer]));
    const inspected = (await client.callTool({
      name: "inspect_recipe",
      arguments: { name: "github-pr-review", version: "0.1.0" },
    })) as ToolResult;
    const loaded = (await client.callTool({
      name: "get_recipe",
      arguments: { name: "github-pr-review", version: "0.1.0" },
    })) as ToolResult;
    const latest = (await client.callTool({
      name: "get_recipe",
      arguments: { name: "github-pr-review" },
    })) as ToolResult;
    const listed = (await client.callTool({
      name: "list_recipe_versions",
      arguments: { name: "github-pr-review" },
    })) as ToolResult;
    const missing = (await client.callTool({
      name: "get_recipe",
      arguments: { name: "github-pr-review", version: "9.9.9" },
    })) as ToolResult;

    expect(inspected.structuredContent).toMatchObject({ version: "0.1.0" });
    expect(JSON.stringify(inspected.structuredContent)).not.toContain(
      "# Historical",
    );
    expect(loaded.structuredContent).toMatchObject({
      version: "0.1.0",
      skill: { body: "# Historical\n" },
    });
    expect(latest.structuredContent).toMatchObject({
      version: "0.2.0",
      skill: { body: "# Current\n" },
    });
    expect(listed.structuredContent).toEqual({
      name: "github-pr-review",
      latest: "0.2.0",
      versions: [
        { version: "0.1.0", integrity: "sha256-0.1.0" },
        { version: "0.2.0", integrity: "sha256-0.2.0" },
      ],
    });
    expect(JSON.stringify(listed.structuredContent)).not.toContain("# Current");
    expect(missing.isError).toBe(true);
    expect(missing.content?.[0]?.text).toContain("9.9.9");
  });

  test("search_prompts and get_prompt return the extractor", async function searchesPrompts() {
    const client = await connect(registryWith([]));
    const searched = (await client.callTool({
      name: "search_prompts",
      arguments: { query: "extract JSON messy text", category: "extraction" },
    })) as ToolResult;
    const loaded = (await client.callTool({
      name: "get_prompt",
      arguments: { name: "structured-data-extractor" },
    })) as ToolResult;
    const missing = (await client.callTool({
      name: "get_prompt",
      arguments: { name: "not-a-prompt" },
    })) as ToolResult;

    expect(searched.isError).toBeFalsy();
    const found = searched.structuredContent as {
      prompts: Array<{ name: string }>;
    };
    expect(found.prompts[0]?.name).toBe("structured-data-extractor");
    expect(loaded.structuredContent).toMatchObject({
      title: "Structured data extractor",
      category: "extraction",
      variables: ["schema", "input"],
    });
    expect(JSON.stringify(loaded.structuredContent)).toContain("{{input}}");
    expect(missing.isError).toBe(true);
  });

  test("search_learn and get_learn_topic explain RAG", async function explainsRag() {
    const client = await connect(registryWith([]));
    const searched = (await client.callTool({
      name: "search_learn",
      arguments: { query: "RAG" },
    })) as ToolResult;
    const loaded = (await client.callTool({
      name: "get_learn_topic",
      arguments: { slug: "rag" },
    })) as ToolResult;

    const found = searched.structuredContent as {
      topics: Array<{ slug: string }>;
    };
    expect(found.topics[0]?.slug).toBe("rag");
    const topic = loaded.structuredContent as {
      definition: string;
      relatedPrompts: Array<{ name: string }>;
    };
    expect(topic.definition.toLowerCase()).toContain("passages");
    expect(
      topic.relatedPrompts.map(function nameOf(prompt) {
        return prompt.name;
      }),
    ).toContain("rag-grounded-answer");
  });

  test("search_guides and get_guide return the product brief tutorial", async function loadsGuide() {
    const client = await connect(registryWith([]));
    const searched = (await client.callTool({
      name: "search_guides",
      arguments: { query: "structured outputs" },
    })) as ToolResult;
    const loaded = (await client.callTool({
      name: "get_guide",
      arguments: { slug: "ai-product-brief-builder" },
    })) as ToolResult;
    const missing = (await client.callTool({
      name: "get_guide",
      arguments: { slug: "missing-guide" },
    })) as ToolResult;

    expect(searched.isError).toBeFalsy();
    const found = searched.structuredContent as {
      guides: Array<{ slug: string; difficulty: string; url: string }>;
    };
    expect(found.guides[0]).toMatchObject({
      slug: "ai-product-brief-builder",
      difficulty: "beginner",
      url: "https://promptmarket.sh/guides/ai-product-brief-builder",
    });
    const guide = loaded.structuredContent as {
      title: string;
      sections: Array<{ markdown: string }>;
    };
    expect(guide.title).toContain("Product Brief");
    expect(guide.sections[0]?.markdown.length).toBeGreaterThan(20);
    expect(loaded.structuredContent).not.toHaveProperty("html");
    expect(JSON.stringify(loaded.structuredContent)).not.toContain("<!DOCTYPE");
    expect(JSON.stringify(loaded.structuredContent)).toContain("Output.object");
    expect(missing.isError).toBe(true);
  });

  test("search_guides and get_guide return the RAG tutorial", async function loadsRagGuide() {
    const client = await connect(registryWith([]));
    const searched = (await client.callTool({
      name: "search_guides",
      arguments: { query: "RAG" },
    })) as ToolResult;
    const loaded = (await client.callTool({
      name: "get_guide",
      arguments: { slug: "rag-knowledge-base" },
    })) as ToolResult;

    expect(searched.isError).toBeFalsy();
    const found = searched.structuredContent as {
      guides: Array<{ slug: string; url: string }>;
    };
    expect(found.guides[0]?.slug).toBe("rag-knowledge-base");
    expect(found.guides[0]?.url).toBe(
      "https://promptmarket.sh/guides/rag-knowledge-base",
    );
    const guide = loaded.structuredContent as {
      title: string;
      verifiedAt?: string;
      sections: Array<{ markdown: string }>;
    };
    const markdown = guide.sections
      .map(function textOf(section) {
        return section.markdown;
      })
      .join("\n");
    expect(guide.title).toContain("RAG");
    expect(guide.verifiedAt).toBe("2026-09-23");
    expect(guide.sections.length).toBeGreaterThan(10);
    expect(markdown).toContain("cosineDistance");
    expect(markdown).toContain("embedMany");
    expect(JSON.stringify(loaded.structuredContent)).not.toContain("<!DOCTYPE");
  });

  test("search_guides and get_guide return the Convex project manager", async function loadsProjectManagerGuide() {
    const client = await connect(registryWith([]));
    const byConvex = (await client.callTool({
      name: "search_guides",
      arguments: { query: "Convex" },
    })) as ToolResult;
    const byToolCalling = (await client.callTool({
      name: "search_guides",
      arguments: { query: "tool calling" },
    })) as ToolResult;
    const loaded = (await client.callTool({
      name: "get_guide",
      arguments: { slug: "ai-project-manager-convex" },
    })) as ToolResult;

    expect(byConvex.isError).toBeFalsy();
    const convexGuides = byConvex.structuredContent as {
      guides: Array<{ slug: string }>;
    };
    expect(convexGuides.guides[0]?.slug).toBe("ai-project-manager-convex");
    const toolGuides = byToolCalling.structuredContent as {
      guides: Array<{ slug: string }>;
    };
    expect(
      toolGuides.guides.some(function matches(guide) {
        return guide.slug === "ai-project-manager-convex";
      }),
    ).toBe(true);
    const guide = loaded.structuredContent as {
      title: string;
      order?: number;
      verifiedAt?: string;
      sections: Array<{ markdown: string }>;
    };
    const markdown = guide.sections
      .map(function textOf(section) {
        return section.markdown;
      })
      .join("\n");
    expect(guide.title).toContain("Project Manager");
    expect(guide.verifiedAt).toBe("2026-09-23");
    expect(guide.sections.length).toBeGreaterThan(10);
    expect(markdown).toContain("fetchMutation");
    expect(markdown).toContain("isStepCount");
    expect(JSON.stringify(loaded.structuredContent)).not.toContain("<!DOCTYPE");
  });

  test("build_context returns the RAG lesson, prompt, and guide", async function buildsContext() {
    const client = await connect(registryWith([recipe]));
    const loaded = (await client.callTool({
      name: "build_context",
      arguments: {
        query: "I'm building a RAG feature in Next.js with Neon",
        detail: "compact",
      },
    })) as ToolResult;

    expect(loaded.isError).toBeFalsy();
    const context = loaded.structuredContent as {
      topics: Array<{ slug: string; definition: string }>;
      prompts: Array<{ name: string; body: string }>;
      guides: Array<{ slug: string; url: string }>;
      skills: Array<{ name: string }>;
    };
    expect(context.topics[0]?.slug).toBe("rag");
    expect(context.topics[0]?.definition.length).toBeGreaterThan(0);
    expect(context.prompts[0]?.name).toBe("rag-grounded-answer");
    expect(context.prompts[0]?.body.length).toBeGreaterThan(0);
    expect(context.guides[0]?.slug).toBe("rag-knowledge-base");
    expect(context.guides[0]?.url).toContain("/guides/rag-knowledge-base");
    expect(context.skills).toEqual([]);
  });

  test("build_context tailors guides to a supplied project fingerprint", async function projectContext() {
    const client = await connect(registryWith([]));
    const loaded = (await client.callTool({
      name: "build_context",
      arguments: {
        query: "add a knowledge base",
        project: {
          framework: "Next.js",
          packages: ["ai", "@openrouter/ai-sdk-provider", "drizzle-orm"],
          database: ["Neon"],
          orm: ["Drizzle"],
        },
      },
    })) as ToolResult;
    const intent = (await client.callTool({
      name: "build_context",
      arguments: {
        query: "teach me Convex tool calling",
        project: {
          framework: "Next.js",
          database: ["Neon"],
          packages: ["ai"],
        },
      },
    })) as ToolResult;

    expect(loaded.isError).toBeFalsy();
    const context = loaded.structuredContent as {
      guides: Array<{ slug: string }>;
      matches?: Array<{ name: string; reasons: string[] }>;
    };
    expect(context.guides[0]?.slug).toBe("rag-knowledge-base");
    expect(
      context.matches?.find(function guide(match) {
        return match.name === "rag-knowledge-base";
      })?.reasons,
    ).toEqual(expect.arrayContaining(["Project uses Neon", "Project uses Drizzle"]));
    const convex = intent.structuredContent as {
      guides: Array<{ slug: string }>;
    };
    expect(convex.guides[0]?.slug).toBe("ai-project-manager-convex");
  });
});
