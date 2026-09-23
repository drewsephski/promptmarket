import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  ContentError,
  detectPlaceholders,
  loadContentCatalog,
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
});
