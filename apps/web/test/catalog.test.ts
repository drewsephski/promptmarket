import path from "node:path";
import { FileRegistry } from "@promptmarket/registry";
import { describe, expect, test } from "vitest";
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
});
