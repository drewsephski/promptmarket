import type { RecipeSummary } from "@promptmarket/registry";
import {
  categoryLabel,
  rankItems,
  type Difficulty,
  type PromptCategory,
  type PromptDocument,
} from "@promptmarket/content";

export type GalleryKind = "prompt" | "skill";

export type GalleryItem = {
  slug: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  tags: string[];
  kind: GalleryKind;
  difficulty?: Difficulty;
  href: string;
};

const SKILL_TITLES: Record<string, string> = {
  "github-pr-review": "GitHub pull request review",
  "repo-onboarding": "Repository onboarding",
  "release-readiness-check": "Release readiness check",
  "nextjs-debug-production-build": "Next.js production build debug",
  "safe-database-migration": "Safe database migration",
  "dependency-security-audit": "Dependency security audit",
  "github-issue-to-implementation": "GitHub issue to implementation",
};

export function promptGalleryItem(prompt: PromptDocument): GalleryItem {
  return {
    slug: prompt.slug,
    title: prompt.title,
    description: prompt.description,
    category: prompt.category,
    categoryLabel: categoryLabel(prompt.category),
    tags: prompt.tags,
    kind: "prompt",
    difficulty: prompt.difficulty,
    href: prompt.href,
  };
}

export function skillGalleryItem(recipe: RecipeSummary): GalleryItem {
  return {
    slug: recipe.name,
    title: SKILL_TITLES[recipe.name] ?? recipe.name,
    description: recipe.description,
    category: "coding",
    categoryLabel: "Coding",
    tags: recipe.tags,
    kind: "skill",
    href: `/recipes/${recipe.name}`,
  };
}

export function filterGallery(
  items: GalleryItem[],
  options: {
    query?: string;
    category?: string;
    kind?: string;
    difficulty?: string;
  },
): GalleryItem[] {
  let pool = items;
  if (options.kind === "prompt" || options.kind === "skill") {
    pool = pool.filter(function byKind(item) {
      return item.kind === options.kind;
    });
  }
  if (options.category) {
    pool = pool.filter(function byCategory(item) {
      return item.category === options.category;
    });
  }
  if (
    options.difficulty === "beginner" ||
    options.difficulty === "intermediate" ||
    options.difficulty === "advanced"
  ) {
    pool = pool.filter(function byDifficulty(item) {
      return item.difficulty === options.difficulty;
    });
  }
  const query = options.query?.trim() ?? "";
  if (query.length === 0) {
    return pool;
  }
  return rankItems(query, pool, function fields(item) {
    return {
      title: `${item.title} ${item.slug}`,
      description: item.description,
      category: `${item.category} ${item.categoryLabel}`,
      tags: item.tags,
      extra: [item.kind],
    };
  }).map(function unwrap(ranked) {
    return ranked.item;
  });
}

export function isPromptCategory(value: string): value is PromptCategory {
  return [
    "extraction",
    "classification",
    "structured-output",
    "rag",
    "tool-calling",
    "agents",
    "summarization",
    "transformation",
    "search",
    "support",
    "moderation",
    "evaluation",
    "coding",
  ].includes(value);
}
