import path from "node:path";
import { FileRegistry } from "@promptmarket/registry";
import { describe, expect, test } from "vitest";
import { generateStaticParams as guideParams } from "../app/guides/[slug]/page";
import sitemap from "../app/sitemap";
import { generateStaticParams as learnParams } from "../app/learn/[slug]/page";
import { generateStaticParams as promptParams } from "../app/prompts/[slug]/page";
import { filterGallery, promptGalleryItem } from "../lib/gallery";
import { parseGuideMarkdown } from "../lib/guide-markdown";
import { parseSkillMarkdown } from "../lib/skill-markdown";
import {
  exactInstallCommand,
  latestInstallCommand,
  recipeHref,
  searchQuery,
  submitCommand,
  versionQuery,
} from "../lib/present";

const registry = new FileRegistry({
  recipesDir: path.resolve(import.meta.dirname, "../../../recipes"),
});

describe("catalog presentation", function catalogPresentation() {
  test("builds install commands and shareable hrefs", function buildsCommands() {
    expect(latestInstallCommand("github-pr-review")).toBe(
      "pnpm dlx @promptmarket/cli add github-pr-review",
    );
    expect(exactInstallCommand("github-pr-review", "0.1.0")).toBe(
      "pnpm dlx @promptmarket/cli add github-pr-review@0.1.0",
    );
    expect(recipeHref("github-pr-review", "0.1.0")).toBe(
      "/recipes/github-pr-review?version=0.1.0",
    );
    expect(searchQuery(["database", "ignored"])).toBe("database");
    expect(versionQuery(undefined)).toBeUndefined();
    expect(submitCommand("my-recipe")).toBe(
      "pnpm dlx @promptmarket/cli submit ./my-recipe",
    );
  });

  test("searches the same registry the CLI uses", async function searchesRegistry() {
    const readiness = await registry.search("release readiness");
    const database = await registry.search("database");
    const historical = await registry.get("github-pr-review", "0.1.0");

    expect(
      readiness.map(function nameOf(recipe) {
        return recipe.name;
      }),
    ).toEqual(["release-readiness-check"]);
    expect(
      database.map(function nameOf(recipe) {
        return recipe.name;
      }),
    ).toContain("safe-database-migration");
    expect(historical.manifest.version).toBe("0.1.0");
  });

  test("renders skill headings and lists without raw html", function rendersSkill() {
    const blocks = parseSkillMarkdown(
      "# Title\n\nUse `gh issue view`.\n\n1. Read the issue\n2. Edit the file\n",
    );

    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
    expect(blocks[2]).toMatchObject({ type: "list", ordered: true });
    expect(JSON.stringify(blocks)).not.toContain("<script");
  });

  test("parses guide files, commands, and checkpoints without html", function parsesGuide() {
    const blocks = parseGuideMarkdown(
      "Create `lib/ai.ts`.\n\n```ts lib/ai.ts\nexport const model = true;\n```\n\n> **Checkpoint:** Open http://localhost:3000.\n",
    );

    expect(blocks[1]).toMatchObject({
      type: "code",
      filename: "lib/ai.ts",
      language: "ts",
    });
    expect(blocks[2]).toMatchObject({ type: "callout", kind: "checkpoint" });
    const labeled = parseGuideMarkdown(
      "**Missing `OPENROUTER_API_KEY`.** Put it in `.env.local`.\n",
    );
    expect(labeled[0]).toMatchObject({
      type: "paragraph",
      inlines: [
        {
          type: "strong",
          children: [
            { type: "text", text: "Missing " },
            { type: "code", text: "OPENROUTER_API_KEY" },
            { type: "text", text: "." },
          ],
        },
        { type: "text", text: " Put it in " },
        { type: "code", text: ".env.local" },
        { type: "text", text: "." },
      ],
    });
    expect(JSON.stringify(blocks)).not.toContain("<script");
  });

  test("builds the learn and prompt routes and filters the gallery", function buildsRoutes() {
    const lessons = learnParams();
    const prompts = promptParams();
    const extractor = prompts.find(function matches(item) {
      return item.slug === "structured-data-extractor";
    });

    expect(
      lessons.map(function slugOf(item) {
        return item.slug;
      }),
    ).toEqual(expect.arrayContaining(["rag", "evals"]));
    expect(extractor).toBeDefined();
    expect(
      guideParams().map(function slugOf(item) {
        return item.slug;
      }),
    ).toEqual(
      expect.arrayContaining([
        "ai-product-brief-builder",
        "rag-knowledge-base",
        "ai-project-manager-convex",
      ]),
    );
    expect(
      sitemap().map(function urlOf(entry) {
        return entry.url;
      }),
    ).toEqual(
      expect.arrayContaining([
        "https://promptmarket.sh/guides/rag-knowledge-base",
        "https://promptmarket.sh/guides/ai-project-manager-convex",
      ]),
    );
    const visible = filterGallery(
      [
        promptGalleryItem({
          slug: "structured-data-extractor",
          title: "Structured data extractor",
          description: "Extract a JSON object from messy user text.",
          category: "extraction",
          tags: ["json"],
          difficulty: "beginner",
          whenToUse: "When the shape is known.",
          whyItWorks: "The schema is the contract.",
          commonMistakes: ["No schema"],
          relatedTopics: ["structured-outputs"],
          relatedPrompts: [],
          body: "Use {{input}}",
          variables: ["input"],
          href: "/prompts/structured-data-extractor",
        }),
      ],
      { query: "json", category: "extraction", kind: "prompt" },
    );
    expect(visible).toHaveLength(1);
  });
});
