import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { ContentError, ContentNotFoundError } from "./errors.js";
import { detectPlaceholders } from "./placeholders.js";
import { rankItems } from "./search.js";
import {
  CATEGORY_LABELS,
  DIAGRAMS,
  DIFFICULTIES,
  MODULES,
  PROMPT_CATEGORIES,
  type DiagramId,
  type Difficulty,
  type LearnSections,
  type LearnSummary,
  type LearnTopic,
  type ModuleId,
  type PromptCategory,
  type PromptDocument,
  type PromptSummary,
  type Recommendation,
} from "./types.js";

const LEARN_SECTIONS = [
  "Example",
  "Implementation notes",
  "Common mistakes",
] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ContentCatalog = {
  topics: LearnTopic[];
  prompts: PromptDocument[];
  getTopic(slug: string): LearnTopic;
  getPrompt(name: string): PromptDocument;
  searchTopics(query: string): LearnSummary[];
  searchPrompts(query: string, category?: string): PromptSummary[];
  recommendPrompt(task: string): Recommendation;
};

type LoadOptions = {
  contentDir?: string;
};

function isDirectory(directory: string): boolean {
  try {
    return statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

function looksLikeContent(directory: string): boolean {
  return (
    isDirectory(path.join(directory, "learn")) &&
    isDirectory(path.join(directory, "prompts"))
  );
}

function walkForContent(start: string): string | undefined {
  let current = path.resolve(start);
  for (;;) {
    const candidate = path.join(current, "content");
    if (looksLikeContent(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

export function resolveContentDir(options?: LoadOptions): string {
  if (options?.contentDir) {
    const explicit = path.resolve(options.contentDir);
    if (!looksLikeContent(explicit)) {
      throw new ContentError(
        explicit,
        "Expected learn/ and prompts/ directories",
      );
    }
    return explicit;
  }

  const fromEnv = process.env.PROMPTMARKET_CONTENT_DIR;
  if (fromEnv) {
    return resolveContentDir({ contentDir: fromEnv });
  }

  const fromCwd = walkForContent(process.cwd());
  if (fromCwd) {
    return fromCwd;
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const fromModule = walkForContent(moduleDir);
  if (fromModule) {
    return fromModule;
  }

  const besideModule = path.join(moduleDir, "content");
  if (looksLikeContent(besideModule)) {
    return besideModule;
  }

  throw new ContentError(
    "content",
    "Could not find content/learn and content/prompts. Set PROMPTMARKET_CONTENT_DIR or run from a PromptMarket checkout.",
  );
}

function asRecord(value: unknown, file: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContentError(file, "Frontmatter must be a mapping");
  }
  return value as Record<string, unknown>;
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  file: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ContentError(file, `${key} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  file: string,
): string | undefined {
  if (!(key in record) || record[key] === null || record[key] === undefined) {
    return undefined;
  }
  return requireString(record, key, file);
}

function requireStringList(
  record: Record<string, unknown>,
  key: string,
  file: string,
): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new ContentError(file, `${key} must be a non-empty list`);
  }
  return value.map(function item(entry, index) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new ContentError(
        file,
        `${key}[${index}] must be a non-empty string`,
      );
    }
    return entry.trim();
  });
}

function requireSlugList(
  record: Record<string, unknown>,
  key: string,
  file: string,
  allowEmpty: boolean,
): string[] {
  const value = record[key];
  if (!Array.isArray(value) || (value.length === 0 && !allowEmpty)) {
    throw new ContentError(
      file,
      allowEmpty ? `${key} must be a list` : `${key} must be a non-empty list`,
    );
  }
  const slugs = value.map(function item(entry, index) {
    if (typeof entry !== "string" || !SLUG.test(entry)) {
      throw new ContentError(file, `${key}[${index}] must be a slug`);
    }
    return entry;
  });
  const unique = new Set(slugs);
  if (unique.size !== slugs.length) {
    throw new ContentError(file, `${key} contains a duplicate`);
  }
  return slugs;
}

function splitFrontmatter(
  source: string,
  file: string,
): {
  data: Record<string, unknown>;
  body: string;
} {
  const normalized = source.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    throw new ContentError(file, "Missing opening frontmatter");
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new ContentError(file, "Missing closing frontmatter");
  }
  const raw = normalized.slice(4, end);
  const body = normalized.slice(end + 5).trim();
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid YAML";
    throw new ContentError(file, message);
  }
  return { data: asRecord(parsed, file), body };
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  file: string,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new ContentError(file, `Unknown field ${key}`);
    }
  }
}

function oneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  file: string,
  label: string,
): T {
  if (!allowed.includes(value as T)) {
    throw new ContentError(
      file,
      `${label} must be one of ${allowed.join(", ")}`,
    );
  }
  return value as T;
}

function learnSections(body: string, file: string): LearnSections {
  if (body.length === 0) {
    throw new ContentError(file, "Missing lesson sections");
  }
  const parts = body.split(/^## /m);
  const preamble = parts[0]?.trim() ?? "";
  if (preamble.length > 0) {
    throw new ContentError(
      file,
      "Move prose into Example, Implementation notes, or Common mistakes",
    );
  }
  const sections = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const newline = part.indexOf("\n");
    const heading = (newline === -1 ? part : part.slice(0, newline)).trim();
    const text = (newline === -1 ? "" : part.slice(newline + 1)).trim();
    if (sections.has(heading)) {
      throw new ContentError(file, `Duplicate section ${heading}`);
    }
    if (text.length === 0) {
      throw new ContentError(file, `Section ${heading} is empty`);
    }
    sections.set(heading, text);
  }
  for (const heading of LEARN_SECTIONS) {
    if (!sections.has(heading)) {
      throw new ContentError(file, `Missing section ${heading}`);
    }
  }
  for (const heading of sections.keys()) {
    if (!LEARN_SECTIONS.includes(heading as (typeof LEARN_SECTIONS)[number])) {
      throw new ContentError(file, `Unexpected section ${heading}`);
    }
  }
  return {
    example: sections.get("Example") ?? "",
    implementationNotes: sections.get("Implementation notes") ?? "",
    commonMistakes: sections.get("Common mistakes") ?? "",
  };
}

function readMarkdownFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter(function markdown(name) {
      return name.endsWith(".md");
    })
    .sort();
}

function loadTopic(filePath: string): LearnTopic {
  const file = path.relative(process.cwd(), filePath);
  const slug = path.basename(filePath, ".md");
  if (!SLUG.test(slug)) {
    throw new ContentError(file, "Filename must be a lowercase slug");
  }
  const source = readFileSync(filePath, "utf8");
  const { data, body } = splitFrontmatter(source, file);
  rejectUnknownKeys(
    data,
    [
      "title",
      "module",
      "order",
      "summary",
      "definition",
      "mentalModel",
      "why",
      "whenToUse",
      "whenNotToUse",
      "diagram",
      "relatedPrompts",
      "relatedTopics",
    ],
    file,
  );
  const order = data.order;
  if (typeof order !== "number" || !Number.isInteger(order) || order < 1) {
    throw new ContentError(file, "order must be a positive integer");
  }
  const diagram = optionalString(data, "diagram", file);
  return {
    slug,
    title: requireString(data, "title", file),
    module: oneOf(
      requireString(data, "module", file),
      MODULES.map(function id(item) {
        return item.id;
      }),
      file,
      "module",
    ),
    order,
    summary: requireString(data, "summary", file),
    definition: requireString(data, "definition", file),
    mentalModel: requireString(data, "mentalModel", file),
    why: requireString(data, "why", file),
    whenToUse: requireStringList(data, "whenToUse", file),
    whenNotToUse: requireStringList(data, "whenNotToUse", file),
    diagram: diagram ? oneOf(diagram, DIAGRAMS, file, "diagram") : undefined,
    sections: learnSections(body, file),
    relatedPrompts: requireSlugList(data, "relatedPrompts", file, false),
    relatedTopics: requireSlugList(data, "relatedTopics", file, true),
    href: `/learn/${slug}`,
  };
}

function loadPrompt(filePath: string): PromptDocument {
  const file = path.relative(process.cwd(), filePath);
  const slug = path.basename(filePath, ".md");
  if (!SLUG.test(slug)) {
    throw new ContentError(file, "Filename must be a lowercase slug");
  }
  const source = readFileSync(filePath, "utf8");
  const { data, body } = splitFrontmatter(source, file);
  if (body.length === 0) {
    throw new ContentError(file, "Prompt body is empty");
  }
  rejectUnknownKeys(
    data,
    [
      "title",
      "description",
      "category",
      "tags",
      "difficulty",
      "whenToUse",
      "whyItWorks",
      "commonMistakes",
      "relatedTopics",
      "relatedPrompts",
      "exampleInput",
      "exampleOutput",
    ],
    file,
  );
  return {
    slug,
    title: requireString(data, "title", file),
    description: requireString(data, "description", file),
    category: oneOf(
      requireString(data, "category", file),
      PROMPT_CATEGORIES,
      file,
      "category",
    ),
    tags: requireSlugList(data, "tags", file, false),
    difficulty: oneOf(
      requireString(data, "difficulty", file),
      DIFFICULTIES,
      file,
      "difficulty",
    ),
    whenToUse: requireString(data, "whenToUse", file),
    whyItWorks: requireString(data, "whyItWorks", file),
    commonMistakes: requireStringList(data, "commonMistakes", file),
    relatedTopics: requireSlugList(data, "relatedTopics", file, false),
    relatedPrompts: requireSlugList(data, "relatedPrompts", file, true),
    exampleInput: optionalString(data, "exampleInput", file),
    exampleOutput: optionalString(data, "exampleOutput", file),
    body,
    variables: detectPlaceholders(body),
    href: `/prompts/${slug}`,
  };
}

function summarizeTopic(topic: LearnTopic): LearnSummary {
  return {
    slug: topic.slug,
    title: topic.title,
    module: topic.module,
    summary: topic.summary,
    href: topic.href,
  };
}

export function summarizePrompt(prompt: PromptDocument): PromptSummary {
  return {
    name: prompt.slug,
    title: prompt.title,
    description: prompt.description,
    category: prompt.category,
    tags: prompt.tags,
    difficulty: prompt.difficulty,
    href: prompt.href,
  };
}

function assertGraph(topics: LearnTopic[], prompts: PromptDocument[]): void {
  const problems: string[] = [];
  const topicBySlug = new Map(
    topics.map(function entry(topic) {
      return [topic.slug, topic] as const;
    }),
  );
  const promptBySlug = new Map(
    prompts.map(function entry(prompt) {
      return [prompt.slug, prompt] as const;
    }),
  );
  const orders = new Set<number>();
  for (const topic of topics) {
    if (orders.has(topic.order)) {
      problems.push(`${topic.slug}: duplicate order ${topic.order}`);
    }
    orders.add(topic.order);
    for (const slug of topic.relatedPrompts) {
      const prompt = promptBySlug.get(slug);
      if (!prompt) {
        problems.push(`${topic.slug}: related prompt ${slug} does not exist`);
        continue;
      }
      if (!prompt.relatedTopics.includes(topic.slug)) {
        problems.push(
          `${topic.slug}: lists ${slug}, but that prompt does not link back`,
        );
      }
    }
    for (const slug of topic.relatedTopics) {
      if (slug === topic.slug) {
        problems.push(`${topic.slug}: cannot relate to itself`);
      }
      const other = topicBySlug.get(slug);
      if (!other) {
        problems.push(`${topic.slug}: related topic ${slug} does not exist`);
        continue;
      }
      if (!other.relatedTopics.includes(topic.slug)) {
        problems.push(
          `${topic.slug}: lists topic ${slug}, but that topic does not link back`,
        );
      }
    }
  }
  for (const prompt of prompts) {
    for (const slug of prompt.relatedTopics) {
      const topic = topicBySlug.get(slug);
      if (!topic) {
        problems.push(`${prompt.slug}: related topic ${slug} does not exist`);
        continue;
      }
      if (!topic.relatedPrompts.includes(prompt.slug)) {
        problems.push(
          `${prompt.slug}: lists topic ${slug}, but that topic does not link back`,
        );
      }
    }
    for (const slug of prompt.relatedPrompts) {
      if (slug === prompt.slug) {
        problems.push(`${prompt.slug}: cannot relate to itself`);
      }
      const other = promptBySlug.get(slug);
      if (!other) {
        problems.push(`${prompt.slug}: related prompt ${slug} does not exist`);
        continue;
      }
      if (!other.relatedPrompts.includes(prompt.slug)) {
        problems.push(
          `${prompt.slug}: lists ${slug}, but that prompt does not link back`,
        );
      }
    }
  }
  if (problems.length > 0) {
    throw new ContentError("catalog", problems.join("\n"));
  }
}

function topicFields(topic: LearnTopic) {
  return {
    title: topic.title,
    description: `${topic.summary} ${topic.definition} ${topic.mentalModel}`,
    category: topic.module,
    tags: topic.relatedTopics,
    extra: topic.relatedPrompts,
    body: [
      topic.why,
      topic.sections.example,
      topic.sections.implementationNotes,
      topic.sections.commonMistakes,
    ].join("\n"),
  };
}

function promptFields(prompt: PromptDocument, topics: Map<string, LearnTopic>) {
  const conceptTitles = prompt.relatedTopics.map(function title(slug) {
    return topics.get(slug)?.title ?? slug;
  });
  return {
    title: `${prompt.title} ${prompt.slug}`,
    description: prompt.description,
    category: `${prompt.category} ${CATEGORY_LABELS[prompt.category]}`,
    tags: prompt.tags,
    extra: [...conceptTitles, prompt.whenToUse],
    body: prompt.body,
  };
}

export function loadContentCatalog(options?: LoadOptions): ContentCatalog {
  const contentDir = resolveContentDir(options);
  const topics = readMarkdownFiles(path.join(contentDir, "learn")).map(
    function read(name) {
      return loadTopic(path.join(contentDir, "learn", name));
    },
  );
  const prompts = readMarkdownFiles(path.join(contentDir, "prompts")).map(
    function read(name) {
      return loadPrompt(path.join(contentDir, "prompts", name));
    },
  );
  topics.sort(function byOrder(left, right) {
    return left.order - right.order;
  });
  prompts.sort(function byTitle(left, right) {
    return left.title.localeCompare(right.title);
  });
  assertGraph(topics, prompts);
  const topicMap = new Map(
    topics.map(function entry(topic) {
      return [topic.slug, topic] as const;
    }),
  );
  const promptMap = new Map(
    prompts.map(function entry(prompt) {
      return [prompt.slug, prompt] as const;
    }),
  );

  return {
    topics,
    prompts,
    getTopic(slug: string): LearnTopic {
      const topic = topicMap.get(slug);
      if (!topic) {
        throw new ContentNotFoundError("topic", slug);
      }
      return topic;
    },
    getPrompt(name: string): PromptDocument {
      const prompt = promptMap.get(name);
      if (!prompt) {
        throw new ContentNotFoundError("prompt", name);
      }
      return prompt;
    },
    searchTopics(query: string): LearnSummary[] {
      return rankItems(query, topics, topicFields).map(
        function summarize(ranked) {
          return summarizeTopic(ranked.item);
        },
      );
    },
    searchPrompts(query: string, category?: string): PromptSummary[] {
      let pool = prompts;
      if (category && category.length > 0) {
        if (!PROMPT_CATEGORIES.includes(category as PromptCategory)) {
          throw new ContentError(
            "category",
            `Unknown category ${category}. Expected one of ${PROMPT_CATEGORIES.join(", ")}`,
          );
        }
        pool = prompts.filter(function matches(prompt) {
          return prompt.category === category;
        });
      }
      return rankItems(query, pool, function fields(prompt) {
        return promptFields(prompt, topicMap);
      }).map(function summarize(ranked) {
        return summarizePrompt(ranked.item);
      });
    },
    recommendPrompt(task: string): Recommendation {
      const ranked = rankItems(task, prompts, function fields(prompt) {
        return promptFields(prompt, topicMap);
      });
      const strong = ranked.filter(function isStrong(item) {
        return item.matchedAll && item.score >= 8;
      });
      const alternativesFrom = function take(
        rows: typeof ranked,
      ): PromptSummary[] {
        return rows.slice(0, 3).map(function summarize(row) {
          return summarizePrompt(row.item);
        });
      };
      const top = strong[0];
      const second = strong[1];
      if (top && (!second || top.score - second.score >= 4)) {
        return {
          recommendation: summarizePrompt(top.item),
          alternatives: alternativesFrom(strong.slice(1)),
        };
      }
      if (strong.length > 1) {
        return {
          recommendation: null,
          alternatives: alternativesFrom(strong),
        };
      }
      return {
        recommendation: null,
        alternatives: alternativesFrom(ranked),
      };
    },
  };
}

export function moduleTitle(id: ModuleId): string {
  const found = MODULES.find(function matches(item) {
    return item.id === id;
  });
  return found?.title ?? id;
}

export function categoryLabel(category: PromptCategory): string {
  return CATEGORY_LABELS[category];
}

export function difficultyLabel(difficulty: Difficulty): string {
  return difficulty.slice(0, 1).toUpperCase() + difficulty.slice(1);
}
