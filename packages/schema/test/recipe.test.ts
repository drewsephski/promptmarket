import { describe, expect, test } from "vitest";
import {
  RecipeManifestSchema,
  SkillFrontmatterSchema,
  SkillNameSchema,
} from "../src/index.js";

const validManifest = {
  schemaVersion: 1,
  name: "github-pr-review",
  version: "0.1.0",
  author: { name: "PromptMarket" },
};

describe("SkillNameSchema", function skillNameSchema() {
  test("accepts a lowercase hyphenated skill name", function acceptsHyphenatedName() {
    expect(SkillNameSchema.safeParse("github-pr-review").success).toBe(true);
  });

  test("rejects consecutive, leading, and trailing hyphens", function rejectsHyphenPlacement() {
    expect(SkillNameSchema.safeParse("foo--bar").success).toBe(false);
    expect(SkillNameSchema.safeParse("foo-").success).toBe(false);
    expect(SkillNameSchema.safeParse("-foo").success).toBe(false);
  });

  test("rejects names longer than 64 characters", function rejectsLongName() {
    expect(SkillNameSchema.safeParse(`a${"b".repeat(64)}`).success).toBe(false);
    expect(SkillNameSchema.safeParse("a".repeat(64)).success).toBe(true);
  });
});

describe("RecipeManifestSchema", function recipeManifestSchema() {
  test("fills PromptMarket defaults and keeps the entrypoint on SKILL.md", function fillsDefaults() {
    const manifest = RecipeManifestSchema.parse(validManifest);

    expect(manifest.entrypoint).toBe("SKILL.md");
    expect(manifest.compatibility).toEqual(["generic"]);
    expect(manifest.requires).toEqual({ mcp: [] });
    expect(manifest.capabilities).toEqual({
      filesystem: "none",
      network: [],
      shell: false,
    });
    expect(manifest.tags).toEqual([]);
  });

  test("rejects a duplicated description field", function rejectsDescription() {
    const result = RecipeManifestSchema.safeParse({
      ...validManifest,
      description: "belongs in SKILL.md",
    });

    expect(result.success).toBe(false);
  });

  test("rejects an entrypoint other than SKILL.md", function rejectsEntrypoint() {
    const result = RecipeManifestSchema.safeParse({
      ...validManifest,
      entrypoint: "README.md",
    });

    expect(result.success).toBe(false);
  });
});

describe("SkillFrontmatterSchema", function skillFrontmatterSchema() {
  test("requires a description of 1 to 1024 characters", function boundsDescription() {
    expect(
      SkillFrontmatterSchema.safeParse({
        name: "github-pr-review",
        description: "",
      }).success,
    ).toBe(false);
    expect(
      SkillFrontmatterSchema.safeParse({
        name: "github-pr-review",
        description: "a".repeat(1024),
      }).success,
    ).toBe(true);
    expect(
      SkillFrontmatterSchema.safeParse({
        name: "github-pr-review",
        description: "a".repeat(1025),
      }).success,
    ).toBe(false);
  });
});
