import { describe, expect, test } from "vitest";
import { LockfileSchema, RecipeSourceSchema } from "../src/index.js";

describe("RecipeSourceSchema", function recipeSourceSchema() {
  test("accepts file and registry sources", function acceptsSources() {
    expect(RecipeSourceSchema.parse({ type: "file" })).toEqual({ type: "file" });
    expect(
      RecipeSourceSchema.parse({
        type: "registry",
        url: "https://promptmarket.sh/api/registry/v1",
      }),
    ).toEqual({
      type: "registry",
      url: "https://promptmarket.sh/api/registry/v1",
    });
  });

  test("rejects a string source", function rejectsStringSource() {
    expect(RecipeSourceSchema.safeParse("file").success).toBe(false);
    expect(
      LockfileSchema.safeParse({
        lockfileVersion: 1,
        recipes: {
          "github-pr-review": {
            name: "github-pr-review",
            version: "0.1.0",
            source: "file",
            integrity: "sha256-eA==",
          },
        },
      }).success,
    ).toBe(false);
  });
});
