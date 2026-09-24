import type { ContentCatalog } from "./load.js";
import { projectStackLabels, type ProjectContext } from "./project.js";
import type { Guide } from "./types.js";

export type CompatibilityStatus = "match" | "differs" | "not-detected";

export type CompatibilityItem = {
  packageName: string;
  label: string;
  status: CompatibilityStatus;
  tested: string;
  detected?: string;
};

export type DoctorGuide = {
  slug: string;
  title: string;
  compatibility: CompatibilityItem[];
  suggestion: string;
};

const PACKAGE_LABELS: Record<string, string> = {
  next: "Next.js",
  ai: "AI SDK",
  "@ai-sdk/react": "AI SDK React",
  "@openrouter/ai-sdk-provider": "OpenRouter provider",
  "drizzle-orm": "Drizzle",
  "@neondatabase/serverless": "Neon",
  convex: "Convex",
  zod: "Zod",
};

function versionParts(value: string): number[] {
  const match = /(\d+(?:\.\d+){0,2})/.exec(value);
  if (!match?.[1]) {
    return [];
  }
  return match[1].split(".").map(function part(item) {
    return Number(item);
  });
}

export function versionsMatch(detected: string, tested: string): boolean {
  const detectedParts = versionParts(detected);
  const testedParts = versionParts(tested);
  if (detectedParts.length === 0 || testedParts.length === 0) {
    return false;
  }
  if (detectedParts.length < testedParts.length) {
    return false;
  }
  return testedParts.every(function same(part, index) {
    return detectedParts[index] === part;
  });
}

export function packageLabel(name: string): string {
  return PACKAGE_LABELS[name] ?? name;
}

export function compatibilityFor(
  guide: Guide,
  project: ProjectContext,
): CompatibilityItem[] {
  const testedWith = guide.testedWith ?? {};
  return Object.entries(testedWith).map(function item([packageName, tested]) {
    const detected = project.versions[packageName];
    if (!detected) {
      const present = project.packages.includes(packageName);
      return {
        packageName,
        label: packageLabel(packageName),
        status: present ? "differs" : "not-detected",
        tested,
      };
    }
    return {
      packageName,
      label: packageLabel(packageName),
      status: versionsMatch(detected, tested) ? "match" : "differs",
      tested,
      detected,
    };
  });
}

function suggestionQuery(guide: Guide, items: CompatibilityItem[]): string {
  const differs = items.some(function mismatch(item) {
    return item.status === "differs";
  });
  let job = guide.title;
  if (guide.concepts.includes("rag")) {
    job = "add RAG";
  } else if (guide.concepts.includes("tool-calling")) {
    job = "add tool calling";
  } else if (guide.concepts.includes("structured-outputs")) {
    job = "return structured JSON";
  }
  return differs ? `upgrade and ${job}` : job;
}

function distinctiveOverlap(guide: Guide, project: ProjectContext): number {
  const labels = projectStackLabels(project);
  return guide.stack.filter(function hit(item) {
    if (item === "TypeScript" || item.startsWith("Next.js")) {
      return false;
    }
    const name = item.toLowerCase();
    return labels.some(function matches(label) {
      const folded = label.toLowerCase();
      return name === folded || name.startsWith(`${folded} `);
    });
  }).length;
}

export function doctorGuides(
  catalog: ContentCatalog,
  project: ProjectContext,
): DoctorGuide[] {
  return catalog.guides
    .map(function score(guide) {
      return { guide, overlap: distinctiveOverlap(guide, project) };
    })
    .filter(function relevant(row) {
      return row.overlap > 0;
    })
    .sort(function byOverlap(left, right) {
      return right.overlap - left.overlap || left.guide.title.localeCompare(right.guide.title);
    })
    .slice(0, 3)
    .map(function present(row) {
      const compatibility = compatibilityFor(row.guide, project);
      return {
        slug: row.guide.slug,
        title: row.guide.title,
        compatibility,
        suggestion: `promptmarket context "${suggestionQuery(row.guide, compatibility)}" --project .`,
      };
    });
}
