import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { LockfileSchema } from "@promptmarket/schema";
import {
  FILE_RECIPE_SOURCE,
  FileRegistry,
  getRecipe,
  installRecipe,
  InvalidRecipeError,
  InvalidRecipeNameError,
  RecipeNotFoundError,
  UnsafeRecipePathError,
  scanRecipes,
  searchRecipes,
  validateRecipe,
  type Recipe,
  type Registry,
} from "../src/index.js";

const recipesDir = path.resolve(import.meta.dirname, "../../../recipes");
const fixture = path.join(recipesDir, "github-pr-review");

const validManifest = `schemaVersion: 1
name: sample-recipe
version: 0.1.0
author:
  name: PromptMarket
`;

const validSkill = `---
name: sample-recipe
description: A sample recipe used to test registry validation.
---

# Sample
`;

describe("registry", function registry() {
  let tempRoot = "";

  beforeEach(async function createTempRoot() {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "promptmarket-"));
  });

  afterEach(async function removeTempRoot() {
    await rm(tempRoot, { recursive: true, force: true });
  });

  async function writeRecipe(options: {
    directoryName: string;
    manifest?: string;
    skill?: string | null;
    parent?: string;
  }): Promise<string> {
    const parent = options.parent ?? path.join(tempRoot, "recipes");
    const recipePath = path.join(parent, options.directoryName);
    await mkdir(recipePath, { recursive: true });
    if (options.manifest !== undefined) {
      await writeFile(
        path.join(recipePath, "promptmarket.yaml"),
        options.manifest,
      );
    }
    if (options.skill !== undefined && options.skill !== null) {
      await writeFile(path.join(recipePath, "SKILL.md"), options.skill);
    }
    return recipePath;
  }

  test("loads the github-pr-review fixture", async function loadsFixture() {
    const result = await validateRecipe(fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.recipe.manifest.name).toBe("github-pr-review");
    expect(result.recipe.manifest.version).toBe("0.1.0");
    expect(result.recipe.manifest.author).toEqual({ name: "PromptMarket" });
    expect(result.recipe.manifest.requires.mcp).toEqual([
      "io.github.github/github-mcp-server",
    ]);
    expect(result.recipe.manifest.compatibility).toEqual([
      "cursor",
      "claude-code",
      "codex",
      "generic",
    ]);
    expect(result.recipe.manifest.capabilities).toEqual({
      filesystem: "read",
      network: ["github.com"],
      shell: false,
    });
    expect(result.recipe.manifest.tags).toEqual([
      "github",
      "pull-request",
      "code-review",
    ]);
    expect(result.recipe.skill.name).toBe("github-pr-review");
    expect(result.recipe.skill.description).toBe(
      "Review GitHub pull requests for correctness, regressions, security issues, maintainability, and missing tests. Use when asked to inspect or review a pull request.",
    );
    expect(result.recipe.skill.body).toContain("# GitHub Pull Request Review");
    expect(result.recipe).not.toHaveProperty("path");
  });

  test("rejects an invalid manifest name", async function rejectsInvalidName() {
    const recipePath = await writeRecipe({
      directoryName: "foo--bar",
      manifest: validManifest.replace("name: sample-recipe", "name: foo--bar"),
      skill: validSkill.replaceAll("sample-recipe", "foo--bar"),
    });

    const result = await validateRecipe(recipePath);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(
      result.errors.some(function invalidName(error) {
        return error.code === "manifest_invalid" && error.path === "name";
      }),
    ).toBe(true);
  });

  test("reports a missing SKILL.md", async function reportsMissingSkill() {
    const recipePath = await writeRecipe({
      directoryName: "sample-recipe",
      manifest: validManifest,
      skill: null,
    });

    const result = await validateRecipe(recipePath);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toEqual([
      {
        code: "skill_missing",
        path: "SKILL.md",
        message: "SKILL.md is missing",
      },
    ]);
  });

  test("reports malformed manifest YAML", async function reportsMalformedYaml() {
    const recipePath = await writeRecipe({
      directoryName: "sample-recipe",
      manifest: "schemaVersion: [\n",
      skill: validSkill,
    });

    const result = await validateRecipe(recipePath);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]?.code).toBe("manifest_parse_error");
  });

  test("reports missing SKILL.md frontmatter", async function reportsMissingFrontmatter() {
    const recipePath = await writeRecipe({
      directoryName: "sample-recipe",
      manifest: validManifest,
      skill: "# Just markdown\n",
    });

    const result = await validateRecipe(recipePath);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toEqual([
      {
        code: "frontmatter_missing",
        path: "SKILL.md",
        message: "SKILL.md is missing YAML frontmatter",
      },
    ]);
  });

  test("reports mismatched manifest and skill names", async function reportsMismatchedNames() {
    const recipePath = await writeRecipe({
      directoryName: "sample-recipe",
      manifest: validManifest,
      skill: validSkill.replaceAll("sample-recipe", "other-recipe"),
    });

    const result = await validateRecipe(recipePath);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toEqual([
      {
        code: "name_mismatch",
        path: "name",
        message:
          'Manifest name "sample-recipe" does not match SKILL.md name "other-recipe"',
      },
    ]);
  });

  test("reports a directory name that does not match the manifest", async function reportsDirectoryMismatch() {
    const recipePath = await writeRecipe({
      directoryName: "other-dir",
      manifest: validManifest,
      skill: validSkill,
    });

    const result = await validateRecipe(recipePath);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toEqual({
      code: "name_mismatch",
      path: "name",
      message:
        'Directory name "other-dir" does not match manifest name "sample-recipe"',
    });
  });

  test("throws when a recipe is unknown", async function throwsForUnknownRecipe() {
    await expect(
      getRecipe("does-not-exist", { recipesDir }),
    ).rejects.toBeInstanceOf(RecipeNotFoundError);
  });

  test("rejects a recipe name before using it as a path", async function rejectsUnsafeName() {
    await expect(
      getRecipe("../github-pr-review", { recipesDir }),
    ).rejects.toBeInstanceOf(InvalidRecipeNameError);
    await expect(getRecipe("Foo/Bar", { recipesDir })).rejects.toBeInstanceOf(
      InvalidRecipeNameError,
    );
  });

  test("loads one recipe when a sibling recipe is invalid", async function ignoresInvalidSibling() {
    const sourceRoot = path.join(tempRoot, "recipes");
    await writeRecipe({
      directoryName: "sample-recipe",
      manifest: validManifest,
      skill: validSkill,
      parent: sourceRoot,
    });
    await writeRecipe({
      directoryName: "random-broken-skill",
      manifest: "schemaVersion: [\n",
      skill: validSkill,
      parent: sourceRoot,
    });

    const registry = new FileRegistry({ recipesDir: sourceRoot });
    const recipe = await getRecipe("sample-recipe", { recipesDir: sourceRoot });
    const matches = await searchRecipes("sample", { recipesDir: sourceRoot });
    const scan = await registry.scan();

    expect(recipe.manifest.name).toBe("sample-recipe");
    expect(
      matches.map(function nameOf(item) {
        return item.name;
      }),
    ).toEqual(["sample-recipe"]);
    expect(scan.invalid).toHaveLength(1);
    expect(scan.invalid[0]?.path).toBe(
      path.join(sourceRoot, "random-broken-skill"),
    );
    expect(scan.invalid[0]?.errors[0]?.code).toBe("manifest_parse_error");
    await expect(
      getRecipe("random-broken-skill", { recipesDir: sourceRoot }),
    ).rejects.toBeInstanceOf(InvalidRecipeError);
  });

  test("searches recipes by description and tags", async function searchesRecipes() {
    const matches = await searchRecipes("review pull request", { recipesDir });
    const misses = await searchRecipes("kubernetes operators", { recipesDir });

    expect(
      matches.map(function nameOf(recipe) {
        return recipe.name;
      }),
    ).toEqual(["github-pr-review"]);
    expect(misses).toEqual([]);
  });

  test("installs the whole skill package and writes a lock entry", async function installsRecipe() {
    const sourceRoot = path.join(tempRoot, "recipes");
    const recipePath = path.join(sourceRoot, "github-pr-review");
    const projectDir = path.join(tempRoot, "project");
    await mkdir(projectDir, { recursive: true });
    await cp(fixture, recipePath, { recursive: true });
    await mkdir(path.join(recipePath, "references"), { recursive: true });
    await writeFile(path.join(recipePath, "references", "notes.md"), "extra\n");
    await writeFile(
      path.join(projectDir, "promptmarket.lock"),
      `${JSON.stringify(
        {
          lockfileVersion: 1,
          recipes: {
            "other-recipe": {
              name: "other-recipe",
              version: "1.0.0",
              source: { type: "file" },
              integrity: "sha256-eA==",
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    const registry = new FileRegistry({ recipesDir: sourceRoot });
    const installed = await installRecipe("github-pr-review", {
      registry,
      projectDir,
    });
    const installedAgain = await installRecipe("github-pr-review", {
      registry,
      projectDir,
    });
    const skill = await readFile(
      path.join(installed.destination, "SKILL.md"),
      "utf8",
    );
    const notes = await readFile(
      path.join(installed.destination, "references", "notes.md"),
      "utf8",
    );
    const manifest = await readFile(
      path.join(installed.destination, "promptmarket.yaml"),
      "utf8",
    );
    const lock = LockfileSchema.parse(
      JSON.parse(
        await readFile(path.join(projectDir, "promptmarket.lock"), "utf8"),
      ),
    );

    expect(skill).toContain("name: github-pr-review");
    expect(notes).toBe("extra\n");
    expect(manifest).toContain("io.github.github/github-mcp-server");
    expect(installed.destination).toBe(
      path.join(projectDir, ".agents", "skills", "github-pr-review"),
    );
    expect(installed.source).toEqual(FILE_RECIPE_SOURCE);
    expect(JSON.stringify(installed.source)).not.toContain(tempRoot);
    expect(installed.integrity).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
    expect(installedAgain.integrity).toBe(installed.integrity);
    expect(lock.recipes["github-pr-review"]).toEqual({
      name: "github-pr-review",
      version: "0.1.0",
      source: FILE_RECIPE_SOURCE,
      integrity: installed.integrity,
    });
    await expect(
      stat(path.join(projectDir, "promptmarket.lock.tmp")),
    ).rejects.toThrow();
    expect(lock.recipes["other-recipe"]?.version).toBe("1.0.0");
    expect(Object.keys(lock.recipes)).toEqual([
      "github-pr-review",
      "other-recipe",
    ]);
  });

  test("refuses to install when the lockfile is invalid", async function refusesInvalidLock() {
    const projectDir = path.join(tempRoot, "project");
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, "promptmarket.lock"), "{\n");

    await expect(
      installRecipe("github-pr-review", {
        registry: new FileRegistry({ recipesDir }),
        projectDir,
      }),
    ).rejects.toThrow(/promptmarket.lock/);
    await expect(
      stat(path.join(projectDir, ".agents", "skills", "github-pr-review")),
    ).rejects.toThrow();
  });

  test("reports a directory that contains only SKILL.md", async function reportsMissingManifest() {
    const sourceRoot = path.join(tempRoot, "recipes");
    await writeRecipe({
      directoryName: "broken-recipe",
      skill: validSkill.replaceAll("sample-recipe", "broken-recipe"),
      parent: sourceRoot,
    });

    const scan = await scanRecipes({ recipesDir: sourceRoot });

    expect(scan.recipes).toEqual([]);
    expect(scan.invalid).toEqual([
      {
        path: path.join(sourceRoot, "broken-recipe"),
        errors: [
          {
            code: "manifest_missing",
            path: "promptmarket.yaml",
            message: "promptmarket.yaml is missing",
          },
        ],
      },
    ]);
  });

  test("treats an empty search as every recipe", async function listsOnEmptySearch() {
    const matches = await searchRecipes("", { recipesDir });

    expect(
      matches.map(function nameOf(recipe) {
        return recipe.name;
      }),
    ).toEqual(["github-pr-review"]);
    expect(matches[0]?.compatibility).toEqual([
      "cursor",
      "claude-code",
      "codex",
      "generic",
    ]);
  });

  test("refuses to install a package path that escapes the destination", async function refusesTraversal() {
    const projectDir = path.join(tempRoot, "project");
    await mkdir(projectDir, { recursive: true });
    const recipe: Recipe = {
      manifest: {
        schemaVersion: 1,
        name: "sample-recipe",
        version: "0.1.0",
        author: { name: "PromptMarket" },
        compatibility: ["generic"],
        requires: { mcp: [] },
        capabilities: { filesystem: "none", network: [], shell: false },
        entrypoint: "SKILL.md",
        tags: [],
      },
      skill: {
        name: "sample-recipe",
        description: "A sample recipe used to test registry validation.",
        body: "# Sample\n",
      },
    };
    const registry: Registry = {
      source: FILE_RECIPE_SOURCE,
      async list() {
        return [];
      },
      async get() {
        return recipe;
      },
      async search() {
        return [];
      },
      async fetchPackage() {
        return {
          recipe,
          integrity: "sha256-eA==",
          files: [
            {
              path: "../../../etc/passwd",
              contents: new TextEncoder().encode("nope\n"),
            },
          ],
        };
      },
    };

    await expect(
      installRecipe("sample-recipe", { registry, projectDir }),
    ).rejects.toBeInstanceOf(UnsafeRecipePathError);
    await expect(
      stat(path.join(projectDir, ".agents", "skills", "sample-recipe")),
    ).rejects.toThrow();
    await expect(stat(path.join(tempRoot, "etc", "passwd"))).rejects.toThrow();
  });
});
