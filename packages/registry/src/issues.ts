import type { RecipeIssue, RecipeIssueCode } from "./types.js";

type ZodIssueLike = {
  path: ReadonlyArray<PropertyKey>;
  message: string;
};

export function issuesFromZod(
  error: { issues: ReadonlyArray<ZodIssueLike> },
  code: RecipeIssueCode,
): RecipeIssue[] {
  return error.issues.map(function mapIssue(issue) {
    return {
      code,
      path: issue.path
        .map(function segment(part) {
          return typeof part === "symbol" ? part.toString() : String(part);
        })
        .join("."),
      message: issue.message,
    };
  });
}
