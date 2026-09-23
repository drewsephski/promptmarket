import type { RecipeIssue } from "./types.js";

export class RecipeNotFoundError extends Error {
  readonly recipeName: string;

  constructor(recipeName: string) {
    super(`Recipe not found: ${recipeName}`);
    this.name = "RecipeNotFoundError";
    this.recipeName = recipeName;
  }
}

export class InvalidRecipeError extends Error {
  readonly recipePath: string;
  readonly issues: RecipeIssue[];

  constructor(recipePath: string, issues: RecipeIssue[]) {
    const detail = issues
      .map(function formatIssue(issue) {
        return issue.message;
      })
      .join("; ");
    super(`Invalid recipe at ${recipePath}: ${detail}`);
    this.name = "InvalidRecipeError";
    this.recipePath = recipePath;
    this.issues = issues;
  }
}
