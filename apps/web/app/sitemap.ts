import { loadContentCatalog } from "@promptmarket/content";
import type { MetadataRoute } from "next";
import { catalogRegistry } from "../lib/catalog";
import { SITE_URL } from "../lib/present";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = loadContentCatalog();
  const recipes = await catalogRegistry().list();
  const paths = [
    "",
    "/learn",
    "/prompts",
    "/guides",
    "/context",
    "/docs",
    "/docs/cli",
    "/docs/mcp",
    "/recipes",
    "/create",
    "/contribute",
    ...recipes.map((recipe) => `/recipes/${recipe.name}`),
    ...catalog.topics.map(function topicPath(topic) {
      return topic.href;
    }),
    ...catalog.prompts.map(function promptPath(prompt) {
      return prompt.href;
    }),
    ...catalog.guides.map(function guidePath(guide) {
      return guide.href;
    }),
  ];
  return [...new Set(paths)].map(function entry(path) {
    return {
      url: `${SITE_URL}${path}`,
    };
  });
}
