import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  ContentError,
  assertDistinctSlugs,
  buildContext,
  contentMeta,
  detectPlaceholders,
  handleContentRequest,
  loadContentCatalog,
  resolveContentDir,
} from "../src/index.js";

describe("promptmarket content", function contentSuite() {
  const tempDirs: string[] = [];

  afterEach(async function cleanup() {
    await Promise.all(
      tempDirs.splice(0).map(function removeDir(directory) {
        return rm(directory, { recursive: true, force: true });
      }),
    );
  });

  test("detects placeholders in order without executing them", function detects() {
    expect(
      detectPlaceholders("Use {{input}} then {{schema}} and {{input}} again."),
    ).toEqual(["input", "schema"]);
  });

  test("loads lessons, prompts, categories, and both directions of the graph", function loadsCatalog() {
    const catalog = loadContentCatalog();
    const rag = catalog.getTopic("rag");
    const extractor = catalog.getPrompt("structured-data-extractor");
    const categories = new Set(
      catalog.prompts.map(function categoryOf(prompt) {
        return prompt.category;
      }),
    );

    expect(
      catalog.topics.map(function slugOf(topic) {
        return topic.slug;
      }),
    ).toContain("evals");
    expect(rag.relatedPrompts).toContain("rag-grounded-answer");
    expect(extractor.relatedTopics).toContain("structured-outputs");
    expect(extractor.variables).toEqual(["schema", "input"]);
    expect(categories.has("extraction")).toBe(true);
    expect(categories.has("evaluation")).toBe(true);

    for (const topic of catalog.topics) {
      for (const name of topic.relatedPrompts) {
        expect(catalog.getPrompt(name).relatedTopics).toContain(topic.slug);
      }
    }
  });

  test("searches prompts and lessons without a model", function searches() {
    const catalog = loadContentCatalog();
    const prompts = catalog.searchPrompts(
      "extract JSON messy text",
      "extraction",
    );
    const lessons = catalog.searchTopics("RAG");
    const recommendation = catalog.recommendPrompt(
      "I need to extract a JSON object from messy user text.",
    );
    const weak = catalog.recommendPrompt("zzzz-not-a-task");

    expect(prompts[0]?.name).toBe("structured-data-extractor");
    expect(lessons[0]?.slug).toBe("rag");
    expect(recommendation.recommendation?.name).toBe(
      "structured-data-extractor",
    );
    expect(weak.recommendation).toBeNull();
  });

  test("loads the product brief guide and searches it", function loadsGuide() {
    const catalog = loadContentCatalog();
    const guide = catalog.getGuide("ai-product-brief-builder");
    const found = catalog.searchGuides("structured outputs");

    expect(guide.difficulty).toBe("beginner");
    expect(guide.verifiedAt).toBe("2026-09-23");
    expect(guide.order).toBe(1);
    expect(guide.stack).toContain("Neon");
    expect(guide.relatedTopics).toContain("structured-outputs");
    expect(guide.relatedPrompts).toContain("structured-data-extractor");
    expect(guide.sections.length).toBeGreaterThan(10);
    expect(
      guide.sections.some(function hasOutput(section) {
        return section.markdown.includes("Output.object");
      }),
    ).toBe(true);
    expect(
      guide.sections.map(function idOf(section) {
        return section.id;
      }),
    ).not.toContain("");
    expect(found[0]?.slug).toBe("ai-product-brief-builder");
    expect(catalog.guidesForTopic("evals")[0]?.slug).toBe(
      "ai-product-brief-builder",
    );
    expect(catalog.guidesForPrompt("json-output-system")[0]?.slug).toBe(
      "ai-product-brief-builder",
    );
    expect(JSON.stringify(guide.sections)).not.toContain("generateObject(");
  });

  test("loads the RAG guide after the product brief guide", function loadsRagGuide() {
    const catalog = loadContentCatalog();
    const guide = catalog.getGuide("rag-knowledge-base");
    const found = catalog.searchGuides("RAG");

    expect(
      catalog.guides.map(function slugOf(item) {
        return item.slug;
      }),
    ).toEqual([
      "ai-product-brief-builder",
      "rag-knowledge-base",
      "ai-project-manager-convex",
    ]);
    expect(guide.order).toBe(2);
    expect(guide.difficulty).toBe("intermediate");
    expect(guide.verifiedAt).toBe("2026-09-23");
    expect(guide.stack).toEqual(
      expect.arrayContaining(["OpenRouter", "Neon", "pgvector", "Drizzle"]),
    );
    expect(guide.relatedTopics).toEqual(
      expect.arrayContaining([
        "rag",
        "question-answering",
        "prompting-fundamentals",
        "evals",
      ]),
    );
    expect(guide.relatedPrompts).toEqual(
      expect.arrayContaining([
        "rag-grounded-answer",
        "answer-with-citations",
        "search-query-rewriter",
      ]),
    );
    expect(found[0]?.slug).toBe("rag-knowledge-base");
    expect(catalog.guidesForTopic("rag")[0]?.slug).toBe("rag-knowledge-base");
    expect(catalog.guidesForPrompt("rag-grounded-answer")[0]?.slug).toBe(
      "rag-knowledge-base",
    );
    const markdown = guide.sections
      .map(function textOf(section) {
        return section.markdown;
      })
      .join("\n");
    expect(markdown).toContain("embedMany");
    expect(markdown).toContain("cosineDistance");
    expect(markdown).toContain("textEmbeddingModel");
    expect(markdown).not.toContain("generateObject(");
    expect(markdown).not.toContain('from "langchain');
    expect(markdown).not.toContain("from 'langchain");
  });

  test("loads the Convex project manager guide", function loadsProjectManagerGuide() {
    const catalog = loadContentCatalog();
    const guide = catalog.getGuide("ai-project-manager-convex");
    const byConvex = catalog.searchGuides("Convex");
    const byToolCalling = catalog.searchGuides("tool calling");

    expect(guide.order).toBe(3);
    expect(guide.difficulty).toBe("intermediate");
    expect(guide.verifiedAt).toBe("2026-09-23");
    expect(guide.stack).toEqual(
      expect.arrayContaining(["OpenRouter", "Convex", "Vercel AI SDK"]),
    );
    expect(guide.relatedTopics).toEqual(
      expect.arrayContaining([
        "tool-calling",
        "agents",
        "agentic-loops",
        "prompting-fundamentals",
        "evals",
      ]),
    );
    expect(guide.relatedPrompts).toEqual(
      expect.arrayContaining([
        "tool-selection-router",
        "safe-tool-calling-system",
      ]),
    );
    expect(byConvex[0]?.slug).toBe("ai-project-manager-convex");
    expect(
      byToolCalling.some(function matches(item) {
        return item.slug === "ai-project-manager-convex";
      }),
    ).toBe(true);
    expect(catalog.guidesForTopic("tool-calling")[0]?.slug).toBe(
      "ai-project-manager-convex",
    );
    expect(catalog.guidesForPrompt("safe-tool-calling-system")[0]?.slug).toBe(
      "ai-project-manager-convex",
    );
    const markdown = guide.sections
      .map(function textOf(section) {
        return section.markdown;
      })
      .join("\n");
    expect(markdown).toContain("isStepCount");
    expect(markdown).toContain("inputSchema");
    expect(markdown).toContain("fetchMutation");
    expect(markdown).toContain("useQuery");
    expect(markdown).not.toContain("stepCountIs(");
    expect(markdown).not.toContain("maxSteps:");
    expect(markdown).not.toContain("@convex-dev/agent");
  });

  test("rejects a guide that points at missing lessons or prompts", async function rejectsBrokenGuide() {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-content-"),
    );
    tempDirs.push(directory);
    await mkdir(path.join(directory, "learn"), { recursive: true });
    await mkdir(path.join(directory, "prompts"), { recursive: true });
    await mkdir(path.join(directory, "guides"), { recursive: true });
    await writeFile(
      path.join(directory, "guides", "sample-guide.md"),
      `---
title: Sample
description: A sample guide
difficulty: beginner
stack:
  - Next.js
concepts:
  - sample
prerequisites:
  - Node.js
whatYouBuild:
  - An app
whatYouLearn:
  - A concept
architecture:
  - Input
relatedTopics:
  - missing-topic
relatedPrompts:
  - missing-prompt
---

## Start

Hello.
`,
    );

    expect(function loadBroken() {
      loadContentCatalog({ contentDir: directory });
    }).toThrow(ContentError);
    try {
      loadContentCatalog({ contentDir: directory });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      expect(message).toContain("sample-guide:");
      expect(message).toContain("related topic missing-topic does not exist");
      expect(message).toContain("related prompt missing-prompt does not exist");
    }
  });

  test("rejects duplicate guide slugs", function rejectsDuplicateSlugs() {
    expect(function duplicate() {
      assertDistinctSlugs("guide", ["alpha", "alpha"]);
    }).toThrow(/duplicate guide slug alpha/);
  });

  test("rejects invalid prompt content with the file path", async function rejectsInvalid() {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-content-"),
    );
    tempDirs.push(directory);
    await mkdir(path.join(directory, "learn"), { recursive: true });
    await mkdir(path.join(directory, "prompts"), { recursive: true });
    await writeFile(
      path.join(directory, "prompts", "broken-prompt.md"),
      `---
title: Broken
description: Missing a category
difficulty: beginner
whenToUse: Sometimes
whyItWorks: It does not
commonMistakes:
  - Everything
relatedTopics: []
relatedPrompts: []
---
Hello {{input}}
`,
    );

    expect(function loadBroken() {
      loadContentCatalog({ contentDir: directory });
    }).toThrow(ContentError);
    try {
      loadContentCatalog({ contentDir: directory });
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      expect(error instanceof Error ? error.message : "").toContain(
        "broken-prompt.md",
      );
    }
  });

  test("assembles RAG context without a model", function assemblesRag() {
    const catalog = loadContentCatalog();
    const context = buildContext(catalog, {
      query: "I'm building a RAG feature in Next.js with Neon",
      detail: "compact",
    });

    expect(context.topics[0]?.slug).toBe("rag");
    expect(context.topics[0]?.definition.length).toBeGreaterThan(0);
    expect(context.topics[0]?.mentalModel?.length).toBeGreaterThan(0);
    expect(context.topics[0]?.commonMistake?.length).toBeGreaterThan(0);
    expect(context.prompts[0]?.name).toBe("rag-grounded-answer");
    expect(context.prompts[0]?.body?.length).toBeGreaterThan(0);
    expect(
      context.prompts.map(function nameOf(prompt) {
        return prompt.name;
      }),
    ).toEqual(
      expect.arrayContaining([
        "answer-with-citations",
        "search-query-rewriter",
      ]),
    );
    expect(context.guides[0]?.slug).toBe("rag-knowledge-base");
    expect(context.guides[0]?.architecture.length).toBeGreaterThan(0);
    expect(context.guides[0]?.url).toBe(
      "https://promptmarket.sh/guides/rag-knowledge-base",
    );
    expect(context.guides[0]?.sections.length).toBeGreaterThan(0);
    expect(context.guides[0]?.sections.length).toBeLessThanOrEqual(2);
    expect(context.prompts[1]?.body).toBeUndefined();
    expect(context.related?.prompts.length).toBeGreaterThan(0);
    expect(
      context.suggestedNextSteps.map(function kindOf(step) {
        return step.kind;
      }),
    ).toEqual(expect.arrayContaining(["topic", "prompt", "guide"]));
  });

  test("assembles tool-calling context for the Convex guide", function assemblesTools() {
    const catalog = loadContentCatalog();
    const context = buildContext(catalog, {
      query: "I'm adding tool calling to a Next.js app with Convex",
      skills: [
        {
          name: "github-pr-review",
          version: "0.2.0",
          description: "Review GitHub pull requests.",
          tags: ["github"],
        },
      ],
    });

    expect(
      context.topics.map(function slugOf(topic) {
        return topic.slug;
      }),
    ).toContain("tool-calling");
    expect(context.guides[0]?.slug).toBe("ai-project-manager-convex");
    expect(
      context.prompts.map(function nameOf(prompt) {
        return prompt.name;
      }),
    ).toEqual(
      expect.arrayContaining([
        "safe-tool-calling-system",
        "tool-selection-router",
      ]),
    );
    expect(context.skills).toEqual([]);
  });

  test("serves the content API from the catalog files", async function servesContent() {
    const catalog = loadContentCatalog();
    const search = await handleContentRequest(
      catalog,
      new Request("https://promptmarket.sh/api/content/v1/search?q=rag"),
    );
    const prompt = await handleContentRequest(
      catalog,
      new Request(
        "https://promptmarket.sh/api/content/v1/prompts/rag-grounded-answer",
      ),
    );
    const lesson = await handleContentRequest(
      catalog,
      new Request("https://promptmarket.sh/api/content/v1/learn/rag"),
    );
    const guide = await handleContentRequest(
      catalog,
      new Request(
        "https://promptmarket.sh/api/content/v1/guides/rag-knowledge-base",
      ),
    );
    const context = await handleContentRequest(
      catalog,
      new Request(
        "https://promptmarket.sh/api/content/v1/context?q=rag&detail=compact",
      ),
    );
    const missing = await handleContentRequest(
      catalog,
      new Request("https://promptmarket.sh/api/content/v1/learn/missing"),
    );

    expect(search.status).toBe(200);
    const searchBody = (await search.json()) as {
      lessons: Array<{ slug: string }>;
      prompts: Array<{ name: string }>;
      guides: Array<{ slug: string }>;
    };
    expect(searchBody.lessons[0]?.slug).toBe("rag");
    expect(searchBody.prompts.map(function nameOf(prompt) {
      return prompt.name;
    })).toContain("rag-grounded-answer");
    expect(searchBody.guides[0]?.slug).toBe("rag-knowledge-base");
    expect(prompt.status).toBe(200);
    expect(lesson.status).toBe(200);
    expect(guide.status).toBe(200);
    expect(context.status).toBe(200);
    const contextBody = (await context.json()) as {
      topics: Array<{ slug: string }>;
    };
    expect(contextBody.topics[0]?.slug).toBe("rag");
    expect(missing.status).toBe(404);
  });

  test("serves content metadata and project-aware context", async function servesMeta() {
    const catalog = loadContentCatalog();
    const meta = contentMeta(catalog, resolveContentDir());
    const response = await handleContentRequest(
      catalog,
      new Request("https://promptmarket.sh/api/content/v1/meta"),
      meta,
    );
    const cached = await handleContentRequest(
      catalog,
      new Request("https://promptmarket.sh/api/content/v1/meta", {
        headers: { "if-none-match": `"${meta.contentVersion}"` },
      }),
      meta,
    );
    const project = await handleContentRequest(
      catalog,
      new Request(
        `https://promptmarket.sh/api/content/v1/context?q=${encodeURIComponent("add a knowledge base")}&project=${encodeURIComponent(
          JSON.stringify({
            framework: "Next.js",
            packages: ["drizzle-orm"],
            database: ["Neon"],
            orm: ["Drizzle"],
          }),
        )}`,
      ),
      meta,
    );
    const intent = await handleContentRequest(
      catalog,
      new Request(
        `https://promptmarket.sh/api/content/v1/context?q=${encodeURIComponent("teach me Convex tool calling")}&project=${encodeURIComponent(
          JSON.stringify({
            framework: "Next.js",
            database: ["Neon"],
            packages: [],
          }),
        )}`,
      ),
      meta,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      schemaVersion: number;
      contentVersion: string;
      counts: { lessons: number; prompts: number; guides: number };
    };
    expect(body.schemaVersion).toBe(1);
    expect(body.contentVersion).toMatch(/^[a-f0-9]{7}$/);
    expect(body.counts.guides).toBe(3);
    expect(cached.status).toBe(304);
    const tailored = (await project.json()) as {
      guides: Array<{ slug: string }>;
      matches: Array<{ name: string; reasons: string[] }>;
    };
    expect(tailored.guides[0]?.slug).toBe("rag-knowledge-base");
    expect(
      tailored.matches.find(function guide(match) {
        return match.name === "rag-knowledge-base";
      })?.reasons,
    ).toEqual(expect.arrayContaining(["Project uses Neon"]));
    const convex = (await intent.json()) as { guides: Array<{ slug: string }> };
    expect(convex.guides[0]?.slug).toBe("ai-project-manager-convex");
  });
});
