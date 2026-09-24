import type { ProjectContext } from "@promptmarket/content";

export const CONTEXT_FILTERS = {
  framework: [{ value: "next", label: "Next.js" }],
  ai: [{ value: "ai-sdk", label: "Vercel AI SDK" }],
  provider: [
    { value: "openrouter", label: "OpenRouter" },
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
  ],
  database: [
    { value: "neon", label: "Neon" },
    { value: "convex", label: "Convex" },
    { value: "supabase", label: "Supabase" },
  ],
  orm: [
    { value: "drizzle", label: "Drizzle" },
    { value: "prisma", label: "Prisma" },
  ],
} as const;

const FRAMEWORKS: Record<string, string> = { next: "Next.js" };
const SDKS: Record<string, string> = { "ai-sdk": "Vercel AI SDK" };
const PROVIDERS: Record<string, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic",
};
const DATABASES: Record<string, string> = {
  neon: "Neon",
  convex: "Convex",
  supabase: "Supabase",
};
const ORMS: Record<string, string> = { drizzle: "Drizzle", prisma: "Prisma" };

export type ContextFilters = {
  framework: string;
  ai: string;
  provider: string;
  database: string;
  orm: string;
};

export function projectFromFilters(filters: ContextFilters): ProjectContext | undefined {
  const framework = FRAMEWORKS[filters.framework];
  const sdk = SDKS[filters.ai];
  const provider = PROVIDERS[filters.provider];
  const database = DATABASES[filters.database];
  const orm = ORMS[filters.orm];
  if (!framework && !sdk && !provider && !database && !orm) {
    return undefined;
  }
  const project: ProjectContext = { packages: [], versions: {} };
  if (framework) {
    project.framework = framework;
  }
  if (sdk || provider) {
    project.ai = {
      ...(sdk ? { sdk } : {}),
      ...(provider ? { provider } : {}),
    };
  }
  if (database) {
    project.database = [database];
  }
  if (orm) {
    project.orm = [orm];
  }
  return project;
}

export function contextSearchParams(query: string, filters: ContextFilters): string {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }
  const text = params.toString();
  return text ? `/context?${text}` : "/context";
}
