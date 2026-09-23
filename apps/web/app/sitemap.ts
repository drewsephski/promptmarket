import { loadContentCatalog } from "@promptmarket/content";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const catalog = loadContentCatalog();
  const paths = [
    "",
    "/learn",
    "/prompts",
    "/guides",
    "/docs",
    "/recipes",
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
  return paths.map(function entry(path) {
    return {
      url: `https://promptmarket.sh${path}`,
    };
  });
}
