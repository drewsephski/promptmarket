import type { ImplementationPlan } from "@promptmarket/content";

export type WorkflowItem = {
  title: string;
  body?: string;
  href?: string;
};

export type WorkflowStage = {
  id: "plan" | "docs" | "debug" | "verify" | "observe";
  label: string;
  stat: string;
  items: WorkflowItem[];
};

export type WorkflowView = {
  pattern: string;
  summary: string;
  stack: string[];
  architecture: string[];
  issues: WorkflowItem[];
  steps: WorkflowItem[];
  verification: string[];
  stages: WorkflowStage[];
  copyText: string;
  guideHref?: string;
};

const PREVIEW_STEPS = 6;

export function previewSteps(steps: WorkflowItem[]): WorkflowItem[] {
  return steps.slice(0, PREVIEW_STEPS);
}

export function stageEmptyCopy(id: WorkflowStage["id"]): string {
  switch (id) {
    case "plan":
      return "No implementation steps for this pattern.";
    case "docs":
      return "No documentation targets for this stack.";
    case "debug":
      return "No DevTools debug targets for this pattern.";
    case "verify":
      return "No eval cases for this pattern yet.";
    case "observe":
      return "No observability setup for this pattern.";
    default:
      return "No details for this stage.";
  }
}

export function workflowView(
  plan: ImplementationPlan,
  summary: string,
  copyText: string,
): WorkflowView {
  const steps = plan.steps.map(function step(item) {
    return { title: item.title, body: item.guidance };
  });
  const docs = plan.documentationTargets.map(function target(item) {
    const version = item.detectedVersion ?? item.testedLine;
    return {
      title: version ? `${item.library} ${version}` : item.library,
      body: item.reason,
    };
  });
  const debug = plan.debugTargets.map(function target(item) {
    return {
      title: "AI SDK DevTools",
      body: `${item.reason} ${item.warning}`,
    };
  });
  const evals = plan.evalTargets.flatMap(function target(item) {
    return item.cases.map(function evalCase(entry) {
      const expectation = Array.isArray(entry.expectation)
        ? entry.expectation.join(", ")
        : entry.expectation;
      return { title: entry.name, body: expectation };
    });
  });
  const observe = plan.observabilityTargets.map(function target(item) {
    return {
      title: "Langfuse",
      body: item.reason,
    };
  });
  const issues = plan.compatibility
    .filter(function issue(item) {
      return item.status === "differs";
    })
    .map(function issue(item) {
      const detected = item.detected ? `, detected ${item.detected}` : "";
      return {
        title: item.label,
        body: `Guide tested ${item.tested}${detected}.`,
      };
    });

  return {
    pattern: plan.pattern.topic,
    summary,
    stack: docs.map(function name(item) {
      return item.title;
    }),
    architecture: plan.architecture,
    issues,
    steps,
    verification: plan.verification,
    stages: [
      {
        id: "plan",
        label: "Plan",
        stat: `${steps.length} ${steps.length === 1 ? "step" : "steps"}`,
        items: steps,
      },
      {
        id: "docs",
        label: "Docs",
        stat: `${docs.length} ${docs.length === 1 ? "target" : "targets"}`,
        items: docs,
      },
      {
        id: "debug",
        label: "Debug",
        stat: debug.length > 0 ? "DevTools" : "None",
        items: debug,
      },
      {
        id: "verify",
        label: "Verify",
        stat: `${evals.length} ${evals.length === 1 ? "eval" : "evals"}`,
        items: evals,
      },
      {
        id: "observe",
        label: "Observe",
        stat: observe.length > 0 ? "Langfuse" : "None",
        items: observe,
      },
    ],
    copyText,
    ...(plan.guide ? { guideHref: `/guides/${plan.guide.slug}` } : {}),
  };
}
