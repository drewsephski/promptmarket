import { loadContentCatalog } from "@promptmarket/content";
import { describe, expect, test } from "vitest";
import { generateMetadata as promptMetadata } from "../app/prompts/page";
import { generateMetadata as contextMetadata } from "../app/context/page";
import { generateMetadata as recipeMetadata } from "../app/recipes/[name]/page";
import { generateMetadata as recipesMetadata } from "../app/recipes/page";
import sitemap from "../app/sitemap";
import robots from "../app/robots";
import { catalogRegistry } from "../lib/catalog";
import { breadcrumbData, serializeJsonLd } from "../lib/structured-data";

describe("search discovery", () => {
  test("keeps editorial pages indexable and excludes internal search variants", async () => {
    const prompts = await promptMetadata({ searchParams: Promise.resolve({}) });
    expect(prompts.robots).toBeUndefined();
    expect(prompts.alternates?.canonical).toBe("/prompts");

    for (const params of [
      { q: "rag" },
      { category: "agents" },
      { q: ["tools", "rag"] },
    ]) {
      const metadata = await promptMetadata({
        searchParams: Promise.resolve(params),
      });
      expect(metadata.robots).toEqual({ index: false, follow: true });
      expect(metadata.alternates?.canonical).toBe("/prompts");
    }

    const context = await contextMetadata({
      searchParams: Promise.resolve({ framework: "nextjs" }),
    });
    expect(context.robots).toEqual({ index: false, follow: true });
    expect(context.alternates?.canonical).toBe("/context");
    const recipes = await recipesMetadata({
      searchParams: Promise.resolve({ q: "review" }),
    });
    expect(recipes.robots).toEqual({ index: false, follow: true });
    expect(recipes.alternates?.canonical).toBe("/recipes");
  });

  test("consolidates skill versions and excludes invalid version error pages", async () => {
    const params = Promise.resolve({ name: "github-pr-review" });
    const version = await recipeMetadata({
      params,
      searchParams: Promise.resolve({ version: "0.1.0" }),
    });
    expect(version.alternates?.canonical).toBe("/recipes/github-pr-review");
    const invalid = await recipeMetadata({
      params,
      searchParams: Promise.resolve({ version: "invalid" }),
    });
    expect(invalid.robots).toEqual({ index: false, follow: true });
  });

  test("discovers every catalog document and latest skill without query URLs", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    const catalog = loadContentCatalog();
    const recipes = await catalogRegistry().list();
    for (const item of [
      ...catalog.prompts,
      ...catalog.topics,
      ...catalog.guides,
    ]) {
      expect(urls).toContain(`https://promptmarket.sh${item.href}`);
    }
    for (const recipe of recipes) {
      expect(urls).toContain(`https://promptmarket.sh/recipes/${recipe.name}`);
    }
    expect(urls).toContain("https://promptmarket.sh/learn/agent-prompts");
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => !url.includes("?") && !url.includes("#"))).toBe(
      true,
    );
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/" });
  });

  test("escapes script termination in structured content without changing its meaning", () => {
    const title = '</script><script>alert("x")</script>';
    const data = breadcrumbData([{ name: title, path: "/prompts" }]);
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(data);
    expect(data.itemListElement[0]?.item).toBe(
      "https://promptmarket.sh/prompts",
    );
  });
});
