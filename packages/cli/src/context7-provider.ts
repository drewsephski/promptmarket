import { Context7, Context7Error, type SearchResponse } from "@upstash/context7-sdk";
import type { DocumentationProvider, LibraryMatch } from "./documentation.js";

const QUERY_LIMIT = 500;
const DOC_LIMIT = 12_000;

export function researchCredentials(): string | undefined {
  const key = process.env.CONTEXT7_API_KEY?.trim();
  return key ? key : undefined;
}

export function missingResearchCredentialsMessage(): string {
  return [
    "promptmarket research is optional and needs CONTEXT7_API_KEY.",
    "plan and context stay available without it.",
  ].join(" ");
}

function documentationText(response: SearchResponse): {
  libraryId?: string;
  documentation: string;
} {
  const libraryId =
    response.codeSnippets[0]?.libraryId ?? response.infoSnippets[0]?.libraryId;
  const parts: string[] = [];
  for (const snippet of response.infoSnippets.slice(0, 6)) {
    const heading = snippet.breadcrumb ? `# ${snippet.breadcrumb}\n` : "";
    parts.push(`${heading}${snippet.content}`);
  }
  for (const snippet of response.codeSnippets.slice(0, 4)) {
    const code = snippet.codeList.map(function body(item) {
      return item.code;
    }).join("\n");
    parts.push(`## ${snippet.codeTitle}\n${snippet.codeDescription}\n\n${code}`);
  }
  return {
    ...(libraryId ? { libraryId } : {}),
    documentation: parts.join("\n\n").slice(0, DOC_LIMIT),
  };
}

export async function createContext7Provider(): Promise<DocumentationProvider> {
  const apiKey = researchCredentials();
  if (!apiKey) {
    throw new Error(missingResearchCredentialsMessage());
  }
  const client = new Context7({ apiKey });
  return {
    async resolveLibrary(input): Promise<LibraryMatch | null> {
      const libraries = await client.searchLibrary(input.question, input.library);
      const match = libraries[0];
      if (!match) {
        return null;
      }
      return { libraryId: match.id, name: match.name };
    },
    async queryDocumentation(input): Promise<string> {
      const docs = await client.getContext(input.question, input.libraryId, {
        type: "txt",
      });
      return docs.slice(0, DOC_LIMIT);
    },
    async search(input) {
      const question = input.question.slice(0, QUERY_LIMIT);
      try {
        const response = await client.search(question, {
          libraries: input.libraries.slice(0, 4),
          ...(input.version ? { version: input.version } : {}),
          language: "TypeScript",
          type: "json",
        });
        return documentationText(response);
      } catch (error) {
        if (error instanceof Context7Error && error.status === 404) {
          return { documentation: "" };
        }
        throw error;
      }
    },
  };
}
