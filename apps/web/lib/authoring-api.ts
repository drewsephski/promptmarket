import {
  coerceRecipeDraft,
  renderRecipeDraft,
  validateRecipeDraft,
  zipRecipeArchive,
  type RecipeIssue,
} from "@promptmarket/registry";

export type AuthoringPreview = {
  ok: boolean;
  issues: RecipeIssue[];
  files: {
    "promptmarket.yaml": string;
    "SKILL.md": string;
  };
};

function mergeIssues(left: RecipeIssue[], right: RecipeIssue[]): RecipeIssue[] {
  const issues = [...left];
  for (const issue of right) {
    const exists = issues.some(function same(existing) {
      return existing.code === issue.code && existing.path === issue.path;
    });
    if (!exists) {
      issues.push(issue);
    }
  }
  return issues;
}

export function previewAuthoringDraft(input: unknown): AuthoringPreview {
  const coerced = coerceRecipeDraft(input);
  const validation = validateRecipeDraft(coerced.draft);
  const issues = mergeIssues(coerced.issues, validation.issues);
  return {
    ok: issues.length === 0,
    issues,
    files: renderRecipeDraft(coerced.draft),
  };
}

export function exportAuthoringDraft(
  input: unknown,
):
  | { ok: true; filename: string; bytes: Uint8Array }
  | { ok: false; issues: RecipeIssue[] } {
  const preview = previewAuthoringDraft(input);
  if (!preview.ok) {
    return { ok: false, issues: preview.issues };
  }
  const draft = coerceRecipeDraft(input).draft;
  const files = [
    {
      path: "promptmarket.yaml",
      contents: new TextEncoder().encode(preview.files["promptmarket.yaml"]),
    },
    {
      path: "SKILL.md",
      contents: new TextEncoder().encode(preview.files["SKILL.md"]),
    },
  ];
  return {
    ok: true,
    filename: `${draft.name}.zip`,
    bytes: zipRecipeArchive(draft.name, files),
  };
}
