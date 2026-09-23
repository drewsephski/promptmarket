import type { RecipeIssue } from "./types.js";

export class InvalidRecipeNameError extends Error {
  readonly recipeName: string;

  constructor(recipeName: string) {
    super(`Invalid recipe name: ${recipeName}`);
    this.name = "InvalidRecipeNameError";
    this.recipeName = recipeName;
  }
}

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

export class UnsafeRecipePathError extends Error {
  readonly recipePath: string;

  constructor(recipePath: string) {
    super(`Unsafe recipe path: ${recipePath}`);
    this.name = "UnsafeRecipePathError";
    this.recipePath = recipePath;
  }
}

export class IntegrityError extends Error {
  readonly expected: string;
  readonly actual: string;

  constructor(expected: string, actual: string) {
    super(
      `Recipe integrity mismatch: expected ${expected}, computed ${actual}`,
    );
    this.name = "IntegrityError";
    this.expected = expected;
    this.actual = actual;
  }
}
