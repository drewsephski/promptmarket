import type { DocumentationProvider, LibraryMatch } from "./documentation.js";

const TOOLS_SPECIFIER = "@upstash/context7-tools-ai-sdk";
const AI_SPECIFIER = "ai";
const OPENROUTER_SPECIFIER = "@openrouter/ai-sdk-provider";
const RESEARCH_MODEL = "z-ai/glm-5.3-flash";

type ToolExecute = (
  input: Record<string, unknown>,
) => Promise<unknown>;

type Context7Module = {
  resolveLibraryId: (options?: { apiKey?: string }) => { execute?: ToolExecute };
  queryDocs: (options?: { apiKey?: string }) => { execute?: ToolExecute };
};

type OpenRouterModule = {
  createOpenRouter: (options: { apiKey: string }) => {
    chat: (model: string) => unknown;
  };
};

type AiModule = {
  generateText: (options: {
    model: unknown;
    tools: Record<string, unknown>;
    stopWhen: unknown;
    prompt: string;
  }) => Promise<{
    steps?: Array<{
      toolResults?: Array<{ toolName?: string; output?: unknown }>;
    }>;
  }>;
  stepCountIs: (count: number) => unknown;
};

export function researchCredentials(): { openRouter: string; context7: string } | undefined {
  const openRouter = process.env.OPENROUTER_API_KEY?.trim();
  const context7 = process.env.CONTEXT7_API_KEY?.trim();
  if (!openRouter || !context7) {
    return undefined;
  }
  return { openRouter, context7 };
}

export function missingResearchCredentialsMessage(): string {
  return [
    "promptmarket research is optional and needs OPENROUTER_API_KEY and CONTEXT7_API_KEY.",
    "plan and context stay available without them.",
  ].join(" ");
}

async function loadSpecifier(specifier: string): Promise<Record<string, unknown>> {
  try {
    return (await import(specifier)) as Record<string, unknown>;
  } catch {
    throw new Error(
      `promptmarket research could not load ${specifier}. Install ai, @openrouter/ai-sdk-provider, and @upstash/context7-tools-ai-sdk to use this command.`,
    );
  }
}

function textOf(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined) {
    return "";
  }
  return JSON.stringify(value);
}

function libraryIdOf(value: unknown, library: string): LibraryMatch | null {
  if (typeof value === "string" && value.startsWith("/")) {
    return { libraryId: value, name: library };
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const direct = record.libraryId ?? record.id;
  if (typeof direct === "string" && direct.startsWith("/")) {
    const name = typeof record.name === "string" ? record.name : library;
    return { libraryId: direct, name };
  }
  const results = record.results ?? record.libraries;
  if (Array.isArray(results) && results.length > 0) {
    return libraryIdOf(results[0], library);
  }
  return null;
}

export async function createContext7Provider(): Promise<DocumentationProvider> {
  const credentials = researchCredentials();
  if (!credentials) {
    throw new Error(missingResearchCredentialsMessage());
  }
  const tools = (await loadSpecifier(TOOLS_SPECIFIER)) as Context7Module;
  const ai = (await loadSpecifier(AI_SPECIFIER)) as AiModule;
  const openrouterModule = (await loadSpecifier(OPENROUTER_SPECIFIER)) as OpenRouterModule;
  const resolveTool = tools.resolveLibraryId({ apiKey: credentials.context7 });
  const queryTool = tools.queryDocs({ apiKey: credentials.context7 });
  const model = openrouterModule
    .createOpenRouter({ apiKey: credentials.openRouter })
    .chat(process.env.PROMPTMARKET_RESEARCH_MODEL?.trim() || RESEARCH_MODEL);

  return {
    async resolveLibrary(input): Promise<LibraryMatch | null> {
      if (resolveTool.execute) {
        const output = await resolveTool.execute({
          libraryName: input.library,
          query: input.question,
        });
        return libraryIdOf(output, input.library);
      }
      await ai.generateText({
        model,
        tools: { resolveLibraryId: resolveTool },
        stopWhen: ai.stepCountIs(2),
        prompt: `Resolve the Context7 library id for ${input.library}. ${input.question}`,
      });
      return null;
    },
    async queryDocumentation(input): Promise<string> {
      if (queryTool.execute) {
        const output = await queryTool.execute({
          libraryId: input.libraryId,
          query: input.version
            ? `${input.question} Version: ${input.version}`
            : input.question,
        });
        return textOf(output);
      }
      const result = await ai.generateText({
        model,
        tools: { queryDocs: queryTool },
        stopWhen: ai.stepCountIs(3),
        prompt: `Query Context7 library ${input.libraryId}. ${input.question}`,
      });
      const chunks: string[] = [];
      for (const step of result.steps ?? []) {
        for (const toolResult of step.toolResults ?? []) {
          if (toolResult.output !== undefined) {
            chunks.push(textOf(toolResult.output));
          }
        }
      }
      return chunks.join("\n");
    },
  };
}
