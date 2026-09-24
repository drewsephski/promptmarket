import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { ContentError, ContentNotFoundError } from "./errors.js";
import { detectPlaceholders } from "./placeholders.js";
import { rankItems, type Ranked } from "./search.js";
import {
  CATEGORY_LABELS,
  DIAGRAMS,
  DIFFICULTIES,
  MODULES,
  PROMPT_CATEGORIES,
  type DiagramId,
  type Difficulty,
  type Guide,
  type GuideDocTarget,
  type GuideEvidence,
  type GuideSection,
  type GuideSourceReference,
  type GuideSummary,
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
  guides: Guide[];
  getTopic(slug: string): LearnTopic;
  getPrompt(name: string): PromptDocument;
  getGuide(slug: string): Guide;
  searchTopics(query: string): LearnSummary[];
  searchPrompts(query: string, category?: string): PromptSummary[];
  searchGuides(query: string): GuideSummary[];
  guidesForTopic(slug: string): GuideSummary[];
  guidesForPrompt(slug: string): GuideSummary[];
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

function optionalVerifiedAt(
  record: Record<string, unknown>,
  file: string,
): string | undefined {
  const value = optionalString(record, "verifiedAt", file);
  if (value === undefined) {
    return undefined;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new ContentError(file, "verifiedAt must be YYYY-MM-DD");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ContentError(file, "verifiedAt must be a real date");
  }
  return value;
}

function optionalTestedWith(
  record: Record<string, unknown>,
  file: string,
): Record<string, string> | undefined {
  if (!("testedWith" in record) || record.testedWith == null) {
    return undefined;
  }
  const value = record.testedWith;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ContentError(
      file,
      "testedWith must be a mapping of package names to versions",
    );
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    throw new ContentError(file, "testedWith must list at least one package");
  }
  const tested: Record<string, string> = {};
  for (const [name, version] of entries) {
    if (!/^[@a-z0-9][a-z0-9@/._-]*$/i.test(name)) {
      throw new ContentError(file, `testedWith has an invalid package name`);
    }
    if (typeof version !== "string" || !/^\d+(?:\.\d+){0,2}$/.test(version)) {
      throw new ContentError(
        file,
        `testedWith.${name} must be a version such as 16, 7, or 0.45`,
      );
    }
    tested[name] = version;
  }
  return tested;
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

function optionalStringList(
  record: Record<string, unknown>,
  key: string,
  file: string,
): string[] {
  if (!(key in record) || record[key] == null) {
    return [];
  }
  return requireStringList(record, key, file);
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

export function assertDistinctSlugs(kind: string, slugs: string[]): void {
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const slug of slugs) {
    if (seen.has(slug)) {
      problems.push(`duplicate ${kind} slug ${slug}`);
    }
    seen.add(slug);
  }
  if (problems.length > 0) {
    throw new ContentError("catalog", problems.join("\n"));
  }
}

function sectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function guideSections(body: string, file: string): GuideSection[] {
  if (body.length === 0) {
    throw new ContentError(file, "Missing guide sections");
  }
  const lines = body.split("\n");
  const sections: GuideSection[] = [];
  let fence = false;
  let title = "";
  let chunk: string[] = [];
  let started = false;

  function pushSection(): void {
    const markdown = chunk.join("\n").trim();
    if (!started) {
      if (markdown.length > 0) {
        throw new ContentError(file, "Move prose under a ## section");
      }
      return;
    }
    if (markdown.length === 0) {
      throw new ContentError(file, `Section ${title} is empty`);
    }
    const id = sectionId(title);
    if (!SLUG.test(id)) {
      throw new ContentError(file, `Section ${title} needs a slug id`);
    }
    if (
      sections.some(function same(section) {
        return section.id === id;
      })
    ) {
      throw new ContentError(file, `Duplicate section ${title}`);
    }
    sections.push({ id, title, markdown });
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      fence = !fence;
    }
    if (!fence && line.startsWith("## ")) {
      pushSection();
      title = line.slice(3).trim();
      if (title.length === 0) {
        throw new ContentError(file, "Section heading is empty");
      }
      chunk = [];
      started = true;
      continue;
    }
    chunk.push(line);
  }
  if (fence) {
    throw new ContentError(file, "Unclosed code fence");
  }
  pushSection();
  if (sections.length === 0) {
    throw new ContentError(file, "Missing guide sections");
  }
  return sections;
}

const PACKAGE_NAME = /^[@a-z0-9][a-z0-9@/._-]*$/i;
const GITHUB_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function optionalEvidence(
  record: Record<string, unknown>,
  file: string,
): GuideEvidence {
  if (!("evidence" in record) || record.evidence == null) {
    return { docs: [], references: [] };
  }
  const value = record.evidence;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ContentError(file, "evidence must be a mapping");
  }
  const evidence = value as Record<string, unknown>;
  rejectUnknownKeys(evidence, ["docs", "references"], file);
  return {
    docs: evidenceDocs(evidence.docs, file),
    references: evidenceReferences(evidence.references, file),
  };
}

function evidenceDocs(value: unknown, file: string): GuideDocTarget[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ContentError(file, "evidence.docs must be a non-empty list");
  }
  const seen = new Set<string>();
  return value.map(function item(entry, index) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new ContentError(file, `evidence.docs[${index}] must be a mapping`);
    }
    const record = entry as Record<string, unknown>;
    rejectUnknownKeys(record, ["package", "library", "reason"], file);
    const packageName = requireString(record, "package", file);
    if (!PACKAGE_NAME.test(packageName)) {
      throw new ContentError(
        file,
        `evidence.docs[${index}].package is not a package name`,
      );
    }
    if (seen.has(packageName)) {
      throw new ContentError(file, `evidence.docs repeats ${packageName}`);
    }
    seen.add(packageName);
    return {
      package: packageName,
      library: requireString(record, "library", file),
      reason: requireString(record, "reason", file),
    };
  });
}

function evidenceReferences(
  value: unknown,
  file: string,
): GuideSourceReference[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ContentError(file, "evidence.references must be a list");
  }
  return value.map(function item(entry, index) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new ContentError(
        file,
        `evidence.references[${index}] must be a mapping`,
      );
    }
    const record = entry as Record<string, unknown>;
    rejectUnknownKeys(record, ["type", "repo", "reason"], file);
    const type = requireString(record, "type", file);
    if (type !== "github") {
      throw new ContentError(
        file,
        `evidence.references[${index}].type must be github`,
      );
    }
    const repo = requireString(record, "repo", file);
    if (!GITHUB_REPO.test(repo)) {
      throw new ContentError(
        file,
        `evidence.references[${index}].repo must be owner/name`,
      );
    }
    return {
      type: "github",
      repo,
      reason: requireString(record, "reason", file),
    };
  });
}

function loadGuide(filePath: string): Guide {
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
      "description",
      "difficulty",
      "stack",
      "concepts",
      "estimatedTime",
      "order",
      "verifiedAt",
      "testedWith",
      "prerequisites",
      "whatYouBuild",
      "whatYouLearn",
      "architecture",
      "relatedTopics",
      "relatedPrompts",
      "verification",
      "evidence",
    ],
    file,
  );
  let order: number | undefined;
  if ("order" in data && data.order !== null && data.order !== undefined) {
    if (
      typeof data.order !== "number" ||
      !Number.isInteger(data.order) ||
      data.order < 1
    ) {
      throw new ContentError(file, "order must be a positive integer");
    }
    order = data.order;
  }
  return {
    slug,
    title: requireString(data, "title", file),
    description: requireString(data, "description", file),
    difficulty: oneOf(
      requireString(data, "difficulty", file),
      DIFFICULTIES,
      file,
      "difficulty",
    ),
    stack: requireStringList(data, "stack", file),
    concepts: requireSlugList(data, "concepts", file, false),
    estimatedTime: optionalString(data, "estimatedTime", file),
    order,
    verifiedAt: optionalVerifiedAt(data, file),
    testedWith: optionalTestedWith(data, file),
    prerequisites: requireStringList(data, "prerequisites", file),
    whatYouBuild: requireStringList(data, "whatYouBuild", file),
    whatYouLearn: requireStringList(data, "whatYouLearn", file),
    architecture: requireStringList(data, "architecture", file),
    relatedTopics: requireSlugList(data, "relatedTopics", file, false),
    relatedPrompts: requireSlugList(data, "relatedPrompts", file, false),
    verification: optionalStringList(data, "verification", file),
    evidence: optionalEvidence(data, file),
    sections: guideSections(body, file),
    href: `/guides/${slug}`,
  };
}

function loadGuides(contentDir: string): Guide[] {
  const directory = path.join(contentDir, "guides");
  if (!isDirectory(directory)) {
    return [];
  }
  const guides = readMarkdownFiles(directory).map(function read(name) {
    return loadGuide(path.join(directory, name));
  });
  assertDistinctSlugs(
    "guide",
    guides.map(function slugOf(guide) {
      return guide.slug;
    }),
  );
  const orders = guides.flatMap(function orderOf(guide) {
    return guide.order === undefined ? [] : [guide.order];
  });
  assertDistinctSlugs(
    "guide order",
    orders.map(function label(order) {
      return String(order);
    }),
  );
  guides.sort(function byOrder(left, right) {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.title.localeCompare(right.title);
  });
  return guides;
}

export function summarizeGuide(guide: Guide): GuideSummary {
  return {
    slug: guide.slug,
    title: guide.title,
    description: guide.description,
    difficulty: guide.difficulty,
    stack: guide.stack,
    concepts: guide.concepts,
    estimatedTime: guide.estimatedTime,
    href: guide.href,
  };
}

function guideFields(guide: Guide) {
  return {
    title: guide.title,
    description: guide.description,
    category: guide.difficulty,
    tags: [...guide.concepts, ...guide.stack, ...guide.relatedTopics],
    extra: guide.relatedPrompts,
    body: [
      ...guide.whatYouLearn,
      ...guide.sections.map(function text(section) {
        return `${section.title}\n${section.markdown}`;
      }),
    ].join("\n"),
  };
}

function guidesMatching(
  guides: Guide[],
  field: "relatedTopics" | "relatedPrompts",
  slug: string,
): GuideSummary[] {
  return guides
    .filter(function matches(guide) {
      return guide[field].includes(slug);
    })
    .map(summarizeGuide);
}

function assertGraph(
  topics: LearnTopic[],
  prompts: PromptDocument[],
  guides: Guide[],
): void {
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
  for (const guide of guides) {
    for (const slug of guide.relatedTopics) {
      if (!topicBySlug.has(slug)) {
        problems.push(`${guide.slug}: related topic ${slug} does not exist`);
      }
    }
    for (const slug of guide.relatedPrompts) {
      if (!promptBySlug.has(slug)) {
        problems.push(`${guide.slug}: related prompt ${slug} does not exist`);
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
  const guides = loadGuides(contentDir);
  topics.sort(function byOrder(left, right) {
    return left.order - right.order;
  });
  prompts.sort(function byTitle(left, right) {
    return left.title.localeCompare(right.title);
  });
  assertGraph(topics, prompts, guides);
  return createContentCatalog(topics, prompts, guides);
}

export function createContentCatalog(
  topics: LearnTopic[],
  prompts: PromptDocument[],
  guides: Guide[],
): ContentCatalog {
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
  const guideMap = new Map(
    guides.map(function entry(guide) {
      return [guide.slug, guide] as const;
    }),
  );

  return {
    topics,
    prompts,
    guides,
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
    getGuide(slug: string): Guide {
      const guide = guideMap.get(slug);
      if (!guide) {
        throw new ContentNotFoundError("guide", slug);
      }
      return guide;
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
    searchGuides(query: string): GuideSummary[] {
      return rankItems(query, guides, guideFields).map(
        function summarize(ranked) {
          return summarizeGuide(ranked.item);
        },
      );
    },
    guidesForTopic(slug: string): GuideSummary[] {
      return guidesMatching(guides, "relatedTopics", slug);
    },
    guidesForPrompt(slug: string): GuideSummary[] {
      return guidesMatching(guides, "relatedPrompts", slug);
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

export function rankContent(
  catalog: ContentCatalog,
  query: string,
): {
  topics: Ranked<LearnTopic>[];
  prompts: Ranked<PromptDocument>[];
  guides: Ranked<Guide>[];
} {
  const topicMap = new Map(
    catalog.topics.map(function entry(topic) {
      return [topic.slug, topic] as const;
    }),
  );
  return {
    topics: rankItems(query, catalog.topics, topicFields),
    prompts: rankItems(query, catalog.prompts, function fields(prompt) {
      return promptFields(prompt, topicMap);
    }),
    guides: rankItems(query, catalog.guides, guideFields),
  };
}
