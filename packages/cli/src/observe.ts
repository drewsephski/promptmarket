import { existsSync } from "node:fs";
import path from "node:path";
import type {
  ImplementationPlan,
  ObservabilityTarget,
  ProjectContext,
} from "@promptmarket/content";

export const LANGFUSE_PACKAGES = [
  "@langfuse/client",
  "@langfuse/vercel-ai-sdk",
  "@langfuse/tracing",
  "@langfuse/otel",
  "@opentelemetry/sdk-node",
] as const;

export const LANGFUSE_ENV = [
  "LANGFUSE_SECRET_KEY",
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_BASE_URL",
] as const;

const TELEMETRY_PACKAGES = [
  "@opentelemetry/sdk-node",
  "@opentelemetry/api",
  "@sentry/nextjs",
  "@sentry/node",
  "dd-trace",
  "@langfuse/otel",
];

const INSTRUMENTATION_FILES = [
  "instrumentation.ts",
  "instrumentation.js",
  "src/instrumentation.ts",
  "src/instrumentation.js",
];

export type TelemetryFindings = {
  packages: string[];
  files: string[];
};

export function detectTelemetry(
  root: string,
  project: ProjectContext | undefined,
): TelemetryFindings {
  const packages = (project?.packages ?? []).filter(function known(name) {
    return TELEMETRY_PACKAGES.includes(name);
  });
  const files = INSTRUMENTATION_FILES.filter(function present(file) {
    return existsSync(path.join(root, file));
  });
  return { packages, files };
}

function projectLines(project: ProjectContext | undefined): string[] {
  if (!project) {
    return ["No project detected. Pass --project ."];
  }
  const lines = [
    project.framework,
    project.language,
    project.ai?.sdk,
    project.ai?.provider,
    ...(project.database ?? []),
    ...(project.orm ?? []),
  ].filter(function present(label): label is string {
    return Boolean(label);
  });
  return lines.length > 0 ? lines : ["Detected project has no stack labels."];
}

export function formatObservation(plan: ImplementationPlan): string {
  const lines = ["Observe", plan.goal, ""];
  if (plan.observabilityTargets.length === 0) {
    lines.push(
      "This plan has no observability target.",
      "PromptMarket names Langfuse only for RAG, tool calling, and structured output.",
      "",
    );
    return `${lines.join("\n")}\n`;
  }
  for (const target of plan.observabilityTargets) {
    lines.push(`${target.provider} · ${target.environment}`, target.reason, "");
  }
  lines.push("Next: promptmarket observe setup langfuse --project .", "");
  return `${lines.join("\n")}\n`;
}

export function formatLangfuseSetup(
  plan: ImplementationPlan,
  project: ProjectContext | undefined,
  telemetry: TelemetryFindings,
): string {
  const target: ObservabilityTarget | undefined = plan.observabilityTargets.find(
    function langfuse(item) {
      return item.provider === "langfuse";
    },
  );
  if (!target) {
    return [
      "Langfuse setup",
      "",
      "This plan has no Langfuse target.",
      "PromptMarket names production tracing for RAG, tool calling, and structured output.",
      "",
    ].join("\n");
  }
  const feature = plan.evalTargets[0]?.kind ?? plan.guide?.slug ?? "feature";
  const lines = [
    "Langfuse setup",
    "",
    "Project",
    ...projectLines(project),
    "",
    "Install",
    ...LANGFUSE_PACKAGES,
    "",
    "Environment",
    ...LANGFUSE_ENV,
    "",
    "Instrumentation",
    "Current AI SDK 7 integration required.",
    "Register Langfuse on the AI SDK telemetry registry and export spans with the Langfuse OpenTelemetry processor.",
    "Use Context7 and current Langfuse docs before implementation. Do not paste instrumentation from memory.",
    "",
    "Recommended trace metadata",
    `- feature: ${feature}`,
    "- route: the route that calls the model",
    `- environment: ${target.environment}`,
    "",
    "Do not edit application code from this command.",
    "Do not touch .env.local.",
    "Do not overwrite an existing instrumentation file.",
    "Do not replace an existing OpenTelemetry setup.",
    "",
  ];
  if (telemetry.packages.length > 0 || telemetry.files.length > 0) {
    lines.push("Existing telemetry configuration detected.");
    for (const name of telemetry.packages) {
      lines.push(`- package ${name}`);
    }
    for (const file of telemetry.files) {
      lines.push(`- file ${file}`);
    }
    lines.push(
      "No files changed.",
      "Langfuse documents interoperability concerns when Sentry, Datadog, or another OpenTelemetry system already exists.",
      'Use: promptmarket context "add Langfuse to existing OpenTelemetry setup" --project .',
      "",
    );
  }
  lines.push(target.reason, "");
  return `${lines.join("\n")}\n`;
}
