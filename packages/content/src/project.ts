import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type ProjectContext = {
  framework?: string;
  language?: string;
  packageManager?: string;
  packages: string[];
  ai?: {
    sdk?: string;
    provider?: string;
  };
  database?: string[];
  orm?: string[];
};

type PackageJson = {
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const PROVIDERS: Array<[string, string]> = [
  ["@openrouter/ai-sdk-provider", "OpenRouter"],
  ["@ai-sdk/openai", "OpenAI"],
  ["openai", "OpenAI"],
  ["@ai-sdk/anthropic", "Anthropic"],
  ["@anthropic-ai/sdk", "Anthropic"],
  ["@ai-sdk/google", "Google"],
];

const DATABASES: Array<[string, string]> = [
  ["@neondatabase/serverless", "Neon"],
  ["@neondatabase/api-client", "Neon"],
  ["convex", "Convex"],
  ["@supabase/supabase-js", "Supabase"],
  ["@supabase/ssr", "Supabase"],
];

const ORMS: Array<[string, string]> = [
  ["drizzle-orm", "Drizzle"],
  ["prisma", "Prisma"],
  ["@prisma/client", "Prisma"],
];

const OTHER_LABELS: Array<[string, string]> = [
  ["zod", "Zod"],
  ["tailwindcss", "Tailwind CSS"],
  ["@tailwindcss/postcss", "Tailwind CSS"],
];

function readJson(filePath: string): PackageJson | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as PackageJson;
  } catch {
    return undefined;
  }
}

function dependencyNames(manifest: PackageJson | undefined): string[] {
  if (!manifest) {
    return [];
  }
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ];
}

function hasFile(root: string, name: string): boolean {
  return existsSync(path.join(root, name));
}

function hasDirectory(root: string, name: string): boolean {
  return existsSync(path.join(root, name));
}

function majorVersion(range: string | undefined): string | undefined {
  if (!range) {
    return undefined;
  }
  const match = /(\d+)/.exec(range);
  return match?.[1];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function labelsFor(
  packages: readonly string[],
  table: Array<[string, string]>,
): string[] {
  const found: string[] = [];
  for (const [name, label] of table) {
    if (packages.includes(name) && !found.includes(label)) {
      found.push(label);
    }
  }
  return found;
}

export function detectProject(root: string): ProjectContext {
  const directory = path.resolve(root);
  const manifest = hasFile(directory, "package.json")
    ? readJson(path.join(directory, "package.json"))
    : undefined;
  const packages = unique(dependencyNames(manifest)).sort();
  const versions = {
    ...(manifest?.dependencies ?? {}),
    ...(manifest?.devDependencies ?? {}),
    ...(manifest?.peerDependencies ?? {}),
  };

  let framework: string | undefined;
  if (packages.includes("next") || hasFile(directory, "next.config.ts") || hasFile(directory, "next.config.mjs") || hasFile(directory, "next.config.js") || hasFile(directory, "next.config.mts")) {
    const major = majorVersion(versions.next);
    framework = major ? `Next.js ${major}` : "Next.js";
  }

  let language: string | undefined;
  if (hasFile(directory, "tsconfig.json") || packages.includes("typescript")) {
    language = "TypeScript";
  }

  let packageManager: string | undefined;
  const declared = manifest?.packageManager;
  if (declared?.startsWith("pnpm@")) {
    packageManager = "pnpm";
  } else if (declared?.startsWith("npm@")) {
    packageManager = "npm";
  } else if (declared?.startsWith("yarn@")) {
    packageManager = "yarn";
  } else if (hasFile(directory, "pnpm-lock.yaml")) {
    packageManager = "pnpm";
  } else if (hasFile(directory, "package-lock.json")) {
    packageManager = "npm";
  } else if (hasFile(directory, "yarn.lock")) {
    packageManager = "yarn";
  }

  const sdk =
    packages.includes("ai") || packages.some(function aiSdk(name) {
      return name.startsWith("@ai-sdk/");
    })
      ? "Vercel AI SDK"
      : undefined;
  const providers = labelsFor(packages, PROVIDERS);
  const database = labelsFor(packages, DATABASES);
  const orm = labelsFor(packages, ORMS);

  if (
    (hasDirectory(directory, "convex") || hasFile(directory, "convex.json")) &&
    !database.includes("Convex")
  ) {
    database.push("Convex");
  }
  if (hasDirectory(directory, "supabase") && !database.includes("Supabase")) {
    database.push("Supabase");
  }
  if (
    (hasDirectory(directory, "prisma") || hasFile(directory, "prisma/schema.prisma")) &&
    !orm.includes("Prisma")
  ) {
    orm.push("Prisma");
  }
  if (
    (hasFile(directory, "drizzle.config.ts") ||
      hasFile(directory, "drizzle.config.js") ||
      hasFile(directory, "drizzle.config.mjs")) &&
    !orm.includes("Drizzle")
  ) {
    orm.push("Drizzle");
  }

  const context: ProjectContext = { packages };
  if (framework) {
    context.framework = framework;
  }
  if (language) {
    context.language = language;
  }
  if (packageManager) {
    context.packageManager = packageManager;
  }
  if (sdk || providers.length > 0) {
    const ai: NonNullable<ProjectContext["ai"]> = {};
    if (sdk) {
      ai.sdk = sdk;
    }
    if (providers.length === 1 && providers[0]) {
      ai.provider = providers[0];
    } else if (providers.length > 1) {
      ai.provider = providers.join(", ");
    }
    context.ai = ai;
  }
  if (database.length > 0) {
    context.database = database;
  }
  if (orm.length > 0) {
    context.orm = orm;
  }
  return context;
}

export function projectStackLabels(project: ProjectContext): string[] {
  return unique(
    [
      project.framework?.replace(/ \d+$/, ""),
      project.language,
      project.ai?.sdk,
      ...(project.ai?.provider?.split(", ") ?? []),
      ...(project.database ?? []),
      ...(project.orm ?? []),
    ].filter(function present(label): label is string {
      return Boolean(label);
    }),
  );
}

export function otherProjectLabels(project: ProjectContext): string[] {
  return labelsFor(project.packages, OTHER_LABELS);
}

export function parseProjectContext(value: unknown): ProjectContext {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("project must be an object");
  }
  const record = value as Record<string, unknown>;
  const packages = record.packages;
  if (
    packages !== undefined &&
    (!Array.isArray(packages) ||
      packages.some(function bad(item) {
        return typeof item !== "string";
      }))
  ) {
    throw new Error("project.packages must be an array of strings");
  }
  const context: ProjectContext = {
    packages: Array.isArray(packages) ? packages : [],
  };
  if (typeof record.framework === "string" && record.framework.length > 0) {
    context.framework = record.framework;
  }
  if (typeof record.language === "string" && record.language.length > 0) {
    context.language = record.language;
  }
  if (
    typeof record.packageManager === "string" &&
    record.packageManager.length > 0
  ) {
    context.packageManager = record.packageManager;
  }
  if (typeof record.ai === "object" && record.ai !== null) {
    const ai = record.ai as Record<string, unknown>;
    const parsed: NonNullable<ProjectContext["ai"]> = {};
    if (typeof ai.sdk === "string" && ai.sdk.length > 0) {
      parsed.sdk = ai.sdk;
    }
    if (typeof ai.provider === "string" && ai.provider.length > 0) {
      parsed.provider = ai.provider;
    }
    if (parsed.sdk || parsed.provider) {
      context.ai = parsed;
    }
  }
  for (const key of ["database", "orm"] as const) {
    const list = record[key];
    if (list === undefined) {
      continue;
    }
    if (
      !Array.isArray(list) ||
      list.some(function bad(item) {
        return typeof item !== "string";
      })
    ) {
      throw new Error(`project.${key} must be an array of strings`);
    }
    if (list.length > 0) {
      context[key] = list;
    }
  }
  return context;
}
