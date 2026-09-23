import { describe, expect, test } from "vitest";
import {
  RecipeVersionListResponseSchema,
  compareSemver,
  latestSemver,
  parseRecipeRef,
} from "../src/index.js";

describe("recipe references", function recipeReferences() {
  test("parses a name and an exact version", function parsesRefs() {
    expect(parseRecipeRef("github-pr-review")).toEqual({
      name: "github-pr-review",
    });
    expect(parseRecipeRef("github-pr-review@0.1.0")).toEqual({
      name: "github-pr-review",
      version: "0.1.0",
    });
    expect(parseRecipeRef("github-pr-review@1.0.0-rc.1")).toEqual({
      name: "github-pr-review",
      version: "1.0.0-rc.1",
    });
  });

  test("rejects malformed references", function rejectsRefs() {
    expect(function missingVersion() {
      parseRecipeRef("github-pr-review@");
    }).toThrow(/Invalid recipe reference/);
    expect(function badVersion() {
      parseRecipeRef("github-pr-review@banana");
    }).toThrow(/Invalid recipe reference/);
    expect(function extraAt() {
      parseRecipeRef("github-pr-review@0.1.0@extra");
    }).toThrow(/Invalid recipe reference/);
    expect(function badName() {
      parseRecipeRef("GitHub@0.1.0");
    }).toThrow(/Invalid recipe reference/);
  });
});

describe("semver ordering", function semverOrdering() {
  test("orders releases and prereleases", function ordersVersions() {
    const versions = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "0.10.0",
      "0.2.0",
    ];
    const sorted = [...versions].sort(compareSemver);

    expect(sorted).toEqual([
      "0.2.0",
      "0.10.0",
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
    ]);
    expect(latestSemver(versions)).toBe("1.0.0");
    expect(compareSemver("1.0.0+aaa", "1.0.0+bbb")).toBe(0);
    expect(latestSemver(["1.0.0+bbb", "1.0.0+aaa"])).toBe("1.0.0+aaa");
  });
});

describe("version list schema", function versionListSchema() {
  test("accepts a version list and exact package metadata", function acceptsList() {
    expect(
      RecipeVersionListResponseSchema.parse({
        name: "github-pr-review",
        latest: "0.2.0",
        versions: [
          { version: "0.2.0", integrity: "sha256-eA==" },
          { version: "0.1.0", integrity: "sha256-eB==" },
        ],
      }).latest,
    ).toBe("0.2.0");
  });

  test("rejects a latest version that is not listed", function rejectsLatest() {
    expect(
      RecipeVersionListResponseSchema.safeParse({
        name: "github-pr-review",
        latest: "0.3.0",
        versions: [{ version: "0.2.0", integrity: "sha256-eA==" }],
      }).success,
    ).toBe(false);
    expect(
      RecipeVersionListResponseSchema.safeParse({
        name: "github-pr-review",
        latest: "0.1.0",
        versions: [
          { version: "0.1.0", integrity: "sha256-eA==" },
          { version: "0.1.0", integrity: "sha256-eB==" },
        ],
      }).success,
    ).toBe(false);
  });
});
