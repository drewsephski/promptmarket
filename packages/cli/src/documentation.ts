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
    const match = await provider.resolveLibrary({
      library: target.library,
      question,
    });
    if (!match) {
      evidence.push({
        library: target.library,
        package: target.package,
        source: "context7",
        question,
        documentation: "",
      });
      continue;
    }
    const documentation = await provider.queryDocumentation({
      libraryId: match.libraryId,
      question,
      version: target.detectedVersion ?? target.testedLine,
    });
    evidence.push({
      library: target.library,
      package: target.package,
      source: "context7",
      libraryId: match.libraryId,
      question,
      documentation,
    });
  }
  return { kind: "verified_plan", plan, evidence };
}
