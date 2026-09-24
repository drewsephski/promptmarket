import { compatibilityFor, type CompatibilityItem } from "./compatibility.js";
import { debugTargetsFor } from "./plan.js";
import type { DebugTarget } from "./types.js";
import { ContentError } from "./errors.js";
import { rankContent, type ContentCatalog } from "./load.js";
import { projectStackLabels, type ProjectContext } from "./project.js";
import { rankItems, tokenize, type Ranked } from "./search.js";
import type {
  Guide,
  GuideSection,
  LearnTopic,
  PromptDocument,
} from "./types.js";

export const CONTENT_ORIGIN = "https://promptmarket.sh";

const DEFAULT_MAX_ITEMS = 5;
const MAX_ITEMS_LIMIT = 10;
const COMPACT_SECTION_LIMIT = 2;
const CONTEXT_NOISE = new Set(["building", "build", "feature", "features"]);

export type ContextDetail = "compact" | "full";

export type ContextMode = "build" | "debug" | "decide" | "upgrade" | "learn";

export type ContextSkillInput = {
  name: string;
  version: string;
  description: string;
  tags: string[];
};

export type BuildContextOptions = {
  query: string;
  maxItems?: number;
  detail?: ContextDetail;
  skills?: readonly ContextSkillInput[];
  origin?: string;
  project?: ProjectContext;
};

export type ContextTopic = {
  slug: string;
  title: string;
  definition: string;
  mentalModel?: string;
  commonMistake?: string;
  url: string;
  summary?: string;
  why?: string;
  whenToUse?: string[];
  whenNotToUse?: string[];
  example?: string;
  implementationNotes?: string;
  relatedPrompts?: string[];
  relatedTopics?: string[];
};

export type ContextPrompt = {
  name: string;
  title: string;
  description: string;
  category: string;
  variables: string[];
  body?: string;
  url: string;
  whenToUse?: string;
  whyItWorks?: string;
  commonMistakes?: string[];
  exampleInput?: string;
  exampleOutput?: string;
  relatedTopics?: string[];
  relatedPrompts?: string[];
};

export type ContextGuideSection = {
  id: string;
  title: string;
  markdown: string;
};

export type ContextGuide = {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  stack: string[];
  architecture: string[];
  sections: ContextGuideSection[];
  url: string;
  concepts?: string[];
  estimatedTime?: string;
  verifiedAt?: string;
  prerequisites?: string[];
  whatYouBuild?: string[];
  whatYouLearn?: string[];
  relatedTopics?: string[];
  relatedPrompts?: string[];
};

export type ContextSkill = {
  name: string;
  version: string;
  description: string;
  tags: string[];
};

export type ContextNextStep = {
  kind: "topic" | "prompt" | "guide" | "skill" | "query";
  name: string;
  title: string;
  reason: string;
};

export type ContextMatch = {
  kind: "topic" | "prompt" | "guide";
  name: string;
  reasons: string[];
};

export type ProjectNoteStatus = "detected" | "not-detected" | "required";

export type ProjectNote = {
  status: ProjectNoteStatus;
  label: string;
};

export type RelatedItem = {
  kind: "topic" | "prompt" | "guide";
  name: string;
  title: string;
  summary: string;
  url: string;
};

export type BuiltContext = {
  query: string;
  mode: ContextMode;
  topics: ContextTopic[];
  prompts: ContextPrompt[];
  guides: ContextGuide[];
  skills: ContextSkill[];
  suggestedNextSteps: ContextNextStep[];
  primary?: {
    topic?: string;
    prompt?: string;
    guide?: string;
  };
  matches?: ContextMatch[];
  project?: ProjectContext;
  projectNotes?: ProjectNote[];
  related?: {
    topics: RelatedItem[];
    prompts: RelatedItem[];
    guides: RelatedItem[];
  };
  compatibility?: CompatibilityItem[];
  debugTargets?: DebugTarget[];
};

function clampMaxItems(value: number | undefined): number {
  const maxItems = value ?? DEFAULT_MAX_ITEMS;
  if (
    !Number.isInteger(maxItems) ||
    maxItems < 1 ||
    maxItems > MAX_ITEMS_LIMIT
  ) {
    throw new ContentError(
      "maxItems",
      `Expected an integer from 1 to ${MAX_ITEMS_LIMIT}`,
    );
  }
  return maxItems;
}

function assertDetail(detail: ContextDetail | undefined): ContextDetail {
  if (detail === undefined || detail === "compact" || detail === "full") {
    return detail ?? "compact";
  }
  throw new ContentError("detail", 'Expected "compact" or "full"');
}

function titleFocus(
  title: string,
  tokens: string[],
  idf: Map<string, number>,
): number {
  const lower = title.toLowerCase();
  return tokens.reduce(function total(score, token) {
    return lower.includes(token) ? score + (idf.get(token) ?? 1) : score;
  }, 0);
}

function tokenIdf(titles: string[], tokens: string[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const token of tokens) {
    const matches = titles.filter(function contains(title) {
      return title.includes(token);
    }).length;
    weights.set(token, matches === 0 ? 1 : titles.length / matches);
  }
  return weights;
}

function stackOverlap(stack: readonly string[], labels: readonly string[]): string[] {
  const folded = labels.map(function lower(label) {
    return label.toLowerCase();
  });
  return stack.filter(function hit(item) {
    const name = item.toLowerCase();
    return folded.some(function matches(label) {
      return name === label || name.startsWith(`${label} `);
    });
  });
}

function orderForContext<T>(
  query: string,
  rows: Array<{ item: T; score: number; matchedAll: boolean }>,
  titleOf: (item: T) => string,
  maxItems: number,
  projectScore?: (item: T) => number,
): T[] {
  const tokens = tokenize(query);
  const idf = tokenIdf(
    rows.map(function title(row) {
      return titleOf(row.item).toLowerCase();
    }),
    tokens,
  );
  return [...rows]
    .filter(function matched(row) {
      return row.score > 0;
    })
    .sort(function byFocus(left, right) {
      const leftFocus = titleFocus(titleOf(left.item), tokens, idf);
      const rightFocus = titleFocus(titleOf(right.item), tokens, idf);
      if (leftFocus !== rightFocus) {
        return rightFocus - leftFocus;
      }
      if (left.matchedAll !== right.matchedAll) {
        return left.matchedAll ? -1 : 1;
      }
      if (projectScore) {
        const leftProject = projectScore(left.item);
        const rightProject = projectScore(right.item);
        if (leftFocus === rightFocus && leftProject !== rightProject) {
          return rightProject - leftProject;
        }
      }
      return right.score - left.score;
    })
    .slice(0, maxItems)
    .map(function itemOf(row) {
      return row.item;
    });
}

const MODE_HINTS: Record<ContextMode, readonly string[]> = {
  build: ["schema", "build", "embed", "retrieve", "store", "enable", "chunk"],
  debug: ["debug", "error", "threshold", "discard", "common"],
  decide: ["when", "learn", "why", "choose"],
  upgrade: ["version", "upgrade", "migrate", "install", "dependency"],
  learn: ["what", "learn", "how", "works"],
};

export function detectContextMode(query: string): ContextMode {
  if (
    /\b(broken|error|errors|irrelevant|not working|does not work|doesn't work|keeps|nothing changed|failed|wrong)\b/i.test(
      query,
    ) ||
    (/\bwhy\b/i.test(query) && !/\b(build|add|implement)\b/i.test(query))
  ) {
    return "debug";
  }
  if (/\b(should i|should this|should we|versus|\bvs\b|which)\b/i.test(query)) {
    return "decide";
  }
  if (/\b(upgrade|migrate|migration|version)\b/i.test(query)) {
    return "upgrade";
  }
  if (/\b(learn|teach me|what is|what are|explain)\b/i.test(query)) {
    return "learn";
  }
  return "build";
}

function guideStronglyWins(ranked: Ranked<Guide>[], guide: Guide): boolean {
  const row = ranked.find(function same(item) {
    return item.item.slug === guide.slug;
  });
  if (!row || row.score < 8) {
    return false;
  }
  const next = ranked.reduce(function max(highest, item) {
    if (item.item.slug === guide.slug) {
      return highest;
    }
    return Math.max(highest, item.score);
  }, 0);
  return row.score - next >= 3;
}

function coherentTopics(
  focused: string,
  rankedTopics: Ranked<LearnTopic>[],
  ordered: LearnTopic[],
  guide: Guide | undefined,
  rankedGuides: Ranked<Guide>[],
  maxItems: number,
): LearnTopic[] {
  if (!guide || !guideStronglyWins(rankedGuides, guide)) {
    return ordered;
  }
  const primary = ordered[0];
  if (primary && guide.relatedTopics.includes(primary.slug)) {
    return ordered;
  }
  const related = rankedTopics.filter(function linked(row) {
    return guide.relatedTopics.includes(row.item.slug) && row.score > 0;
  });
  const best = orderForContext(
    focused,
    related,
    function title(topic) {
      return topic.title;
    },
    1,
  )[0];
  if (!best) {
    return ordered;
  }
  return [best, ...ordered.filter(function other(topic) {
    return topic.slug !== best.slug;
  })].slice(0, maxItems);
}

function relevantSections(
  guide: Guide,
  query: string,
  detail: ContextDetail,
  mode: ContextMode,
): GuideSection[] {
  if (detail === "full") {
    return guide.sections;
  }
  const tokens = tokenize(query);
  const hints = MODE_HINTS[mode];
  const scored = guide.sections.map(function score(section, index) {
    const haystack = `${section.title}\n${section.markdown}`.toLowerCase();
    const title = section.title.toLowerCase();
    const matches =
      tokens.reduce(function count(total, token) {
        return haystack.includes(token) ? total + 1 : total;
      }, 0) +
      hints.reduce(function bonus(total, hint) {
        return title.includes(hint) ? total + 8 : total;
      }, 0);
    return { index, matches };
  });
  const winners = scored
    .filter(function matched(row) {
      return row.matches > 0;
    })
    .sort(function byMatch(left, right) {
      return right.matches - left.matches || left.index - right.index;
    })
    .slice(0, COMPACT_SECTION_LIMIT);
  const chosen = new Set(
    winners.map(function indexOf(row) {
      return row.index;
    }),
  );
  if (chosen.size === 0 && guide.sections[0]) {
    return [guide.sections[0]];
  }
  return guide.sections.filter(function keep(_section, index) {
    return chosen.has(index);
  });
}

function presentTopic(
  topic: LearnTopic,
  origin: string,
  detail: ContextDetail,
  primary: boolean,
): ContextTopic {
  const url = `${origin}${topic.href}`;
  if (detail === "compact" && !primary) {
    return {
      slug: topic.slug,
      title: topic.title,
      definition: topic.summary,
      url,
    };
  }
  const compact: ContextTopic = {
    slug: topic.slug,
    title: topic.title,
    definition: topic.definition,
    mentalModel: topic.mentalModel,
    commonMistake: topic.sections.commonMistakes.trim(),
    url,
  };
  if (detail === "compact") {
    return compact;
  }
  return {
    ...compact,
    summary: topic.summary,
    why: topic.why,
    whenToUse: topic.whenToUse,
    whenNotToUse: topic.whenNotToUse,
    example: topic.sections.example,
    implementationNotes: topic.sections.implementationNotes,
    relatedPrompts: topic.relatedPrompts,
    relatedTopics: topic.relatedTopics,
  };
}

function presentPrompt(
  prompt: PromptDocument,
  origin: string,
  detail: ContextDetail,
  primary: boolean,
): ContextPrompt {
  const url = `${origin}${prompt.href}`;
  if (detail === "compact" && !primary) {
    return {
      name: prompt.slug,
      title: prompt.title,
      description: prompt.description,
      category: prompt.category,
      variables: prompt.variables,
      url,
    };
  }
  const compact: ContextPrompt = {
    name: prompt.slug,
    title: prompt.title,
    description: prompt.description,
    category: prompt.category,
    variables: prompt.variables,
    body: prompt.body,
    url,
  };
  if (detail === "compact") {
    return compact;
  }
  return {
    ...compact,
    whenToUse: prompt.whenToUse,
    whyItWorks: prompt.whyItWorks,
    commonMistakes: prompt.commonMistakes,
    ...(prompt.exampleInput ? { exampleInput: prompt.exampleInput } : {}),
    ...(prompt.exampleOutput ? { exampleOutput: prompt.exampleOutput } : {}),
    relatedTopics: prompt.relatedTopics,
    relatedPrompts: prompt.relatedPrompts,
  };
}

function presentGuide(
  guide: Guide,
  query: string,
  origin: string,
  detail: ContextDetail,
  primary: boolean,
  mode: ContextMode,
): ContextGuide {
  if (detail === "compact" && !primary) {
    return {
      slug: guide.slug,
      title: guide.title,
      description: guide.description,
      difficulty: guide.difficulty,
      stack: guide.stack,
      architecture: [],
      sections: [],
      url: `${origin}${guide.href}`,
    };
  }
  const compact: ContextGuide = {
    slug: guide.slug,
    title: guide.title,
    description: guide.description,
    difficulty: guide.difficulty,
    stack: guide.stack,
    architecture: guide.architecture,
    sections: relevantSections(guide, query, detail, mode).map(
      function section(item) {
        return {
          id: item.id,
          title: item.title,
          markdown: item.markdown,
        };
      },
    ),
    url: `${origin}${guide.href}`,
  };
  if (detail === "compact") {
    return compact;
  }
  return {
    ...compact,
    concepts: guide.concepts,
    ...(guide.estimatedTime ? { estimatedTime: guide.estimatedTime } : {}),
    ...(guide.verifiedAt ? { verifiedAt: guide.verifiedAt } : {}),
    prerequisites: guide.prerequisites,
    whatYouBuild: guide.whatYouBuild,
    whatYouLearn: guide.whatYouLearn,
    relatedTopics: guide.relatedTopics,
    relatedPrompts: guide.relatedPrompts,
  };
}

function assemblePrompts(
  catalog: ContentCatalog,
  query: string,
  topic: LearnTopic | undefined,
  guide: Guide | undefined,
  maxItems: number,
): PromptDocument[] {
  const ranked = rankContent(catalog, query).prompts.filter(
    function matched(row) {
      return row.score > 0;
    },
  );
  const tokens = tokenize(query);
  const idf = tokenIdf(
    ranked.map(function title(row) {
      return row.item.title.toLowerCase();
    }),
    tokens,
  );
  const guideOrder = guide?.relatedPrompts ?? [];
  const linked = new Set<string>([
    ...(topic?.relatedPrompts ?? []),
    ...guideOrder,
  ]);
  const ordered: PromptDocument[] = [];
  const seen = new Set<string>();

  function push(prompt: PromptDocument | undefined) {
    if (!prompt || seen.has(prompt.slug) || ordered.length >= maxItems) {
      return;
    }
    seen.add(prompt.slug);
    ordered.push(prompt);
  }

  const primary = [...ranked]
    .filter(function linkedHit(row) {
      return linked.has(row.item.slug);
    })
    .sort(function byGuide(left, right) {
      const leftFocus = titleFocus(left.item.title, tokens, idf);
      const rightFocus = titleFocus(right.item.title, tokens, idf);
      if (leftFocus !== rightFocus) {
        return rightFocus - leftFocus;
      }
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      const leftIndex = guideOrder.indexOf(left.item.slug);
      const rightIndex = guideOrder.indexOf(right.item.slug);
      const leftPlace = leftIndex === -1 ? guideOrder.length : leftIndex;
      const rightPlace = rightIndex === -1 ? guideOrder.length : rightIndex;
      return leftPlace - rightPlace;
    })[0];
  push(primary?.item);
  for (const slug of guide?.relatedPrompts ?? []) {
    push(
      catalog.prompts.find(function matches(prompt) {
        return prompt.slug === slug;
      }),
    );
  }
  for (const slug of topic?.relatedPrompts ?? []) {
    push(
      catalog.prompts.find(function matches(prompt) {
        return prompt.slug === slug;
      }),
    );
  }
  for (const row of ranked) {
    push(row.item);
  }
  return ordered;
}

function nextSteps(
  topics: ContextTopic[],
  prompts: ContextPrompt[],
  guides: ContextGuide[],
  skills: ContextSkill[],
): ContextNextStep[] {
  const steps: ContextNextStep[] = [];
  const topic = topics[0];
  const prompt = prompts[0];
  const guide = guides[0];
  const skill = skills[0];
  if (topic) {
    steps.push({
      kind: "topic",
      name: topic.slug,
      title: topic.title,
      reason: "Read the concept before writing the feature.",
    });
  }
  if (prompt) {
    steps.push({
      kind: "prompt",
      name: prompt.name,
      title: prompt.title,
      reason: "Start from this prompt and fill its variables.",
    });
  }
  if (guide) {
    steps.push({
      kind: "guide",
      name: guide.slug,
      title: guide.title,
      reason: "Follow this guide for the architecture.",
    });
  }
  for (const related of prompts.slice(1, 3)) {
    steps.push({
      kind: "prompt",
      name: related.name,
      title: related.title,
      reason: "Use this with the primary prompt.",
    });
  }
  if (skill) {
    steps.push({
      kind: "skill",
      name: skill.name,
      title: skill.name,
      reason: "Install this skill when the job is a repeatable procedure.",
    });
  }
  if (steps.length === 0) {
    steps.push({
      kind: "query",
      name: "query",
      title: "Sharpen the query",
      reason:
        "Name the feature, the framework, and the job the model should do.",
    });
  }
  return steps;
}

function debugField(
  mode: ContextMode,
  guide: Parameters<typeof debugTargetsFor>[0],
  project: Parameters<typeof debugTargetsFor>[1],
): { debugTargets: DebugTarget[] } | Record<string, never> {
  if (mode !== "debug") {
    return {};
  }
  const debugTargets = debugTargetsFor(guide, project);
  if (debugTargets.length === 0) {
    return {};
  }
  return { debugTargets };
}

export function buildContext(
  catalog: ContentCatalog,
  options: BuildContextOptions,
): BuiltContext {
  const maxItems = clampMaxItems(options.maxItems);
  const detail = assertDetail(options.detail);
  const origin = options.origin ?? CONTENT_ORIGIN;
  const query = options.query;
  const mode = detectContextMode(query);
  const tokens = tokenize(query).filter(function keep(token) {
    return !CONTEXT_NOISE.has(token);
  });
  const focused = tokens.length > 0 ? tokens.join(" ") : query;
  const ranked = rankContent(catalog, focused);
  const topics = orderForContext(
    focused,
    ranked.topics,
    function title(topic) {
      return topic.title;
    },
    maxItems,
  );
  const projectLabels = options.project
    ? projectStackLabels(options.project)
    : [];
  const guides = orderForContext(
    focused,
    ranked.guides,
    function title(guide) {
      return guide.title;
    },
    maxItems,
    function overlap(guide) {
      return stackOverlap(guide.stack, projectLabels).length;
    },
  );
  const anchoredTopics = coherentTopics(
    focused,
    ranked.topics,
    topics,
    guides[0],
    ranked.guides,
    maxItems,
  );
  const prompts = assemblePrompts(
    catalog,
    focused,
    anchoredTopics[0],
    guides[0],
    maxItems,
  );
  const skills = orderForContext(
    focused,
    rankItems(focused, options.skills ?? [], function fields(skill) {
      return {
        title: skill.name.replaceAll("-", " "),
        description: skill.description,
        tags: skill.tags,
      };
    }),
    function title(skill) {
      return skill.name.replaceAll("-", " ");
    },
    maxItems,
  );
  const presentedTopics = anchoredTopics.map(function present(topic, index) {
    return presentTopic(topic, origin, detail, index === 0);
  });
  const presentedPrompts = prompts.map(function present(prompt, index) {
    return presentPrompt(prompt, origin, detail, index === 0);
  });
  const presentedGuides = guides.map(function present(guide, index) {
    return presentGuide(guide, focused, origin, detail, index === 0, mode);
  });
  const primaryTopic = presentedTopics[0];
  const primaryPrompt = presentedPrompts[0];
  const primaryGuide = guides[0];
  const presentedGuide = presentedGuides[0];
  const matches: ContextMatch[] = [];
  if (primaryTopic) {
    matches.push({
      kind: "topic",
      name: primaryTopic.slug,
      reasons: queryReasons(focused, primaryTopic.title, [primaryTopic.slug]),
    });
  }
  if (primaryPrompt) {
    matches.push({
      kind: "prompt",
      name: primaryPrompt.name,
      reasons: queryReasons(focused, primaryPrompt.title, [
        primaryPrompt.category,
      ]),
    });
  }
  if (primaryGuide && presentedGuide) {
    const shared = stackOverlap(primaryGuide.stack, projectLabels);
    matches.push({
      kind: "guide",
      name: primaryGuide.slug,
      reasons: [
        ...queryReasons(focused, primaryGuide.title, primaryGuide.concepts),
        ...shared.map(function used(label) {
          return `Project uses ${label}`;
        }),
      ],
    });
  }
  const projectNotes = primaryGuide
    ? notesForGuide(primaryGuide, projectLabels, options.project)
    : undefined;
  const compatibility =
    primaryGuide && options.project
      ? compatibilityFor(primaryGuide, options.project)
      : undefined;
  return {
    query,
    mode,
    topics: presentedTopics,
    prompts: presentedPrompts,
    guides: presentedGuides,
    skills,
    suggestedNextSteps: nextSteps(
      presentedTopics,
      presentedPrompts,
      presentedGuides,
      skills,
    ),
    primary: {
      ...(primaryTopic ? { topic: primaryTopic.slug } : {}),
      ...(primaryPrompt ? { prompt: primaryPrompt.name } : {}),
      ...(presentedGuide ? { guide: presentedGuide.slug } : {}),
    },
    matches,
    ...(options.project ? { project: options.project } : {}),
    ...(projectNotes && projectNotes.length > 0 ? { projectNotes } : {}),
    related: {
      topics: presentedTopics.slice(1).map(function topic(item) {
        return {
          kind: "topic" as const,
          name: item.slug,
          title: item.title,
          summary: item.definition,
          url: item.url,
        };
      }),
      prompts: presentedPrompts.slice(1).map(function prompt(item) {
        return {
          kind: "prompt" as const,
          name: item.name,
          title: item.title,
          summary: item.description,
          url: item.url,
        };
      }),
      guides: presentedGuides.slice(1).map(function guide(item) {
        return {
          kind: "guide" as const,
          name: item.slug,
          title: item.title,
          summary: item.description,
          url: item.url,
        };
      }),
    },
    ...(compatibility && compatibility.length > 0 ? { compatibility } : {}),
    ...debugField(mode, primaryGuide, options.project),
  };
}

function queryReasons(
  query: string,
  title: string,
  concepts: readonly string[],
): string[] {
  const tokens = tokenize(query);
  const haystack = `${title} ${concepts.join(" ")}`.toLowerCase();
  const matched = tokens.filter(function hit(token) {
    return haystack.includes(token);
  });
  if (matched.length === 0) {
    return ["Query matched the catalog wording"];
  }
  return [`Query matched ${matched.join(" and ")}`];
}

const UNVERIFIED_STACK = new Set(["pgvector"]);

function notesForGuide(
  guide: Guide,
  projectLabels: readonly string[],
  project: ProjectContext | undefined,
): ProjectNote[] {
  if (!project) {
    return [];
  }
  const notes: ProjectNote[] = [];
  for (const label of guide.stack) {
    if (label === "TypeScript" || label.startsWith("Next.js")) {
      continue;
    }
    if (UNVERIFIED_STACK.has(label.toLowerCase())) {
      notes.push({ status: "required", label });
      continue;
    }
    const detected = stackOverlap([label], projectLabels).length > 0;
    notes.push({
      status: detected ? "detected" : "not-detected",
      label,
    });
  }
  if (guide.concepts.includes("embeddings")) {
    const seen = project.packages.some(function embedding(name) {
      return name.toLowerCase().includes("embed");
    });
    notes.push({
      status: seen ? "detected" : "required",
      label: "embedding model",
    });
  }
  return notes;
}
