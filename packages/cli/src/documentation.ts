import type {
  DocumentationTarget,
  ImplementationPlan,
} from "@promptmarket/content";

export type LibraryMatch = {
  libraryId: string;
  name: string;
};

export type DocumentationEvidence = {
  library: string;
  package: string;
  source: "context7";
  libraryId?: string;
  question: string;
  documentation: string;
};

export type VerifiedPlan = {
  kind: "verified_plan";
  plan: ImplementationPlan;
  evidence: DocumentationEvidence[];
};

export type DocumentationSearch = {
  libraryId?: string;
  documentation: string;
};

const CONTEXT7_VERSION = /^v?[0-9]+([._][0-9]+){0,2}([-+][a-zA-Z0-9.-]+)?$/;

export function context7Version(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return CONTEXT7_VERSION.test(trimmed) ? trimmed : undefined;
}

export interface DocumentationProvider {
  resolveLibrary(input: {
    library: string;
    question: string;
  }): Promise<LibraryMatch | null>;
  queryDocumentation(input: {
    libraryId: string;
    question: string;
    version?: string;
  }): Promise<string>;
  search(input: {
    question: string;
    libraries: string[];
    version?: string;
  }): Promise<DocumentationSearch>;
}

export function documentationQuestion(target: DocumentationTarget): string {
  const version = target.detectedVersion ?? target.testedLine;
  const line = version ? ` for version ${version}` : "";
  return `How does ${target.library}${line} work for this: ${target.reason}`;
}

export async function groundPlan(
  plan: ImplementationPlan,
  provider: DocumentationProvider,
): Promise<VerifiedPlan> {
  const evidence: DocumentationEvidence[] = [];
  for (const target of plan.documentationTargets) {
    const question = documentationQuestion(target);
    const version = context7Version(target.detectedVersion ?? target.testedLine);
    const result = await provider.search({
      question,
      libraries: [target.library],
      ...(version ? { version } : {}),
    });
    evidence.push({
      library: target.library,
      package: target.package,
      source: "context7",
      ...(result.libraryId ? { libraryId: result.libraryId } : {}),
      question,
      documentation: result.documentation,
    });
  }
  return { kind: "verified_plan", plan, evidence };
}
