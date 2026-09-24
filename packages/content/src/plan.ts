import { compatibilityFor, type CompatibilityItem } from "./compatibility.js";
import {
  buildContext,
  type ContextPrompt,
  type ProjectNote,
} from "./context.js";
import type { ContentCatalog } from "./load.js";
import type { ProjectContext } from "./project.js";
import type { Guide, GuideSection } from "./types.js";

const FRAMING = new Set([
  "what-were-building",
  "what-youll-learn",
  "prerequisites",
  "what-you-learned",
  "next-improvements",
  "related-promptmarket-content",
  "common-errors",
  "debug-a-bad-answer",
  "try-the-app",
  "try-a-small-knowledge-base",
  "test-the-app",
  "follow-a-request-through-the-app",
  "what-an-embedding-is",
  "how-tool-calling-works",
]);

const SCAFFOLD = new Set([
  "create-an-openrouter-api-key",
  "create-your-openrouter-api-key",
  "create-a-neon-database",
  "create-the-neon-database",
  "create-the-next-js-app",
  "install-dependencies",
  "environment-variables",
  "project-structure",
  "set-up-convex",
  "configure-openrouter",
  "add-convex-to-react",
]);

export type PlanStep = {
  title: string;
  guidance: string;
  sourceSection?: string;
};

export type PlanReference = {
  kind: "lesson" | "prompt" | "guide";
  name: string;
  url: string;
};

export type ImplementationPlan = {
  goal: string;
  project?: ProjectContext;
  pattern: {
    topic: string;
    reason: string;
  };
  guide?: {
    slug: string;
    title: string;
    verifiedAt?: string;
  };
  architecture: string[];
  compatibility: CompatibilityItem[];
  requirements: ProjectNote[];
  steps: PlanStep[];
  prompt?: ContextPrompt;
  verification: string[];
  references: PlanReference[];
};

export type BuildPlanOptions = {
  query: string;
  project?: ProjectContext;
  origin?: string;
};

function guidanceOf(markdown: string): string {
  const paragraph = markdown
    .split(/\n\s*\n/)
    .map(function trim(block) {
      return block.trim();
    })
    .find(function prose(block) {
      return (
        block.length > 0 &&
        !block.startsWith("```") &&
        !block.startsWith("|") &&
        !block.startsWith("-") &&
        !/^\d+\./.test(block)
      );
    });
  const text = (paragraph ?? markdown).replace(/\s+/g, " ").trim();
  if (text.length <= 280) {
    return text;
  }
  return `${text.slice(0, 277)}...`;
}

function implementationSections(
  guide: Guide,
  project: ProjectContext | undefined,
): GuideSection[] {
  return guide.sections.filter(function keep(section) {
    if (FRAMING.has(section.id)) {
      return false;
    }
    if (project && SCAFFOLD.has(section.id)) {
      return false;
    }
    return true;
  });
}

export function buildPlan(
  catalog: ContentCatalog,
  options: BuildPlanOptions,
): ImplementationPlan {
  const context = buildContext(catalog, {
    query: options.query,
    project: options.project,
    detail: "compact",
    maxItems: 4,
    origin: options.origin,
  });
  const presented = context.guides[0];
  const guide = presented ? catalog.getGuide(presented.slug) : undefined;
  const topic = context.topics[0];
  const prompt = context.prompts[0];
  const reason =
    context.matches?.find(function topicMatch(match) {
      return match.kind === "topic";
    })?.reasons[0] ??
    (guide
      ? `${guide.title} lists this concept.`
      : "Closest catalog concept for this query.");
  const references: PlanReference[] = [];
  if (topic) {
    references.push({ kind: "lesson", name: topic.title, url: topic.url });
  }
  if (prompt) {
    references.push({ kind: "prompt", name: prompt.title, url: prompt.url });
  }
  if (presented) {
    references.push({
      kind: "guide",
      name: presented.title,
      url: presented.url,
    });
  }
  return {
    goal: options.query,
    ...(options.project ? { project: options.project } : {}),
    pattern: {
      topic: topic?.title ?? "No matching concept",
      reason,
    },
    ...(guide
      ? {
          guide: {
            slug: guide.slug,
            title: guide.title,
            ...(guide.verifiedAt ? { verifiedAt: guide.verifiedAt } : {}),
          },
        }
      : {}),
    architecture: guide?.architecture ?? [],
    compatibility: guide && options.project
      ? compatibilityFor(guide, options.project)
      : [],
    requirements: context.projectNotes ?? [],
    steps: guide
      ? implementationSections(guide, options.project)
          .slice(0, 12)
          .map(function step(section) {
            return {
              title: section.title,
              guidance: guidanceOf(section.markdown),
              sourceSection: section.id,
            };
          })
      : [],
    ...(prompt ? { prompt } : {}),
    verification: guide?.verification ?? [],
    references,
  };
}
