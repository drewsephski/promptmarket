import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { parse } from "yaml";
import {
  digestFiles,
  packRecipe,
  readRecipeFiles,
  renderRecipeDraft,
  scanRecipes,
  validateRecipe,
  validateRecipeDraft,
  writeRecipeDraft,
  type RecipeDraft,
} from "../src/index.js";
import { listTarPaths } from "../src/archive.js";

const recipesDir = path.resolve(import.meta.dirname, "../../../recipes");

function draft(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    name: "sample-agent",
    version: "0.1.0",
    description: 'Review a diff: keep "quotes", colons, and\n--- markers.',
    author: { name: "Ada Lovelace", url: "https://example.com/ada" },
    compatibility: ["cursor", "codex"],
    tags: ["review", "pull-request"],
    requires: { mcp: ["io.github.github/github-mcp-server"] },
    capabilities: {
      filesystem: "read",
      shell: false,
      network: ["github.com"],
    },
    instructions: "# Sample Agent\n\n## When to use\n\nReview a diff.\n",
    ...overrides,
  };
}

describe("recipe authoring", function recipeAuthoring() {
  const tempDirs: string[] = [];

  afterEach(async function cleanup() {
    await Promise.all(
      tempDirs.splice(0).map(function remove(directory) {
        return rm(directory, { recursive: true, force: true });
      }),
    );
  });

  test("renders a deterministic package without a manifest description", function rendersDraft() {
    const rendered = renderRecipeDraft(draft());
    expect(renderRecipeDraft(draft())).toEqual(rendered);
    const manifest = parse(rendered["promptmarket.yaml"]) as Record<
      string,
      unknown
    >;
    expect(manifest).not.toHaveProperty("description");
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      name: "sample-agent",
      version: "0.1.0",
      compatibility: ["cursor", "codex"],
      tags: ["review", "pull-request"],
      requires: { mcp: ["io.github.github/github-mcp-server"] },
      capabilities: {
        filesystem: "read",
        shell: false,
        network: ["github.com"],
      },
      entrypoint: "SKILL.md",
    });
    expect(rendered["SKILL.md"]).toContain("name: sample-agent");
    expect(rendered["SKILL.md"]).toContain("Review a diff:");
    expect(rendered["SKILL.md"]).toContain("# Sample Agent");
  });

  test("rejects invalid names, versions, hosts, and MCP ids", function rejectsDraft() {
    expect(
      validateRecipeDraft(draft({ name: "Bad Name" })).issues,
    ).toContainEqual(
      expect.objectContaining({
        code: "recipe_name_invalid",
        message: "Recipe names are lowercase kebab-case.",
      }),
    );
    expect(
      validateRecipeDraft(draft({ version: "banana" })).issues,
    ).toContainEqual(
      expect.objectContaining({
        code: "invalid_version",
        message: "Version must be valid SemVer.",
      }),
    );
    expect(
      validateRecipeDraft(draft({ description: "  " })).issues,
    ).toContainEqual(
      expect.objectContaining({ code: "skill_description_missing" }),
    );
    expect(
      validateRecipeDraft(
        draft({
          capabilities: {
            filesystem: "read",
            shell: false,
            network: ["https://github.com/foo"],
          },
        }),
      ).issues,
    ).toContainEqual(
      expect.objectContaining({
        code: "network_invalid",
        message: "Network host is malformed.",
      }),
    );
    expect(
      validateRecipeDraft(draft({ requires: { mcp: ["https://example.com"] } }))
        .issues,
    ).toContainEqual(expect.objectContaining({ code: "mcp_invalid" }));
    expect(
      validateRecipeDraft(draft({ instructions: " \n" })).issues,
    ).toContainEqual(expect.objectContaining({ code: "instructions_missing" }));
  });

  test("round-trips escaped frontmatter through validation", async function roundTrips() {
    const rendered = renderRecipeDraft(draft());
    const validation = validateRecipeDraft(draft());
    expect(validation.ok).toBe(true);

    const directory = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-author-"),
    );
    tempDirs.push(directory);
    const recipeDir = path.join(directory, "sample-agent");
    await writeRecipeDraft(recipeDir, draft());
    const result = await validateRecipe(recipeDir);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.recipe.skill.description).toContain("--- markers.");
    expect(await readFile(path.join(recipeDir, "SKILL.md"), "utf8")).toBe(
      rendered["SKILL.md"],
    );
  });

  test("packs the same bytes the registry digests", async function packsRecipe() {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-pack-"),
    );
    tempDirs.push(directory);
    const recipeDir = path.join(directory, "sample-agent");
    await writeRecipeDraft(recipeDir, draft({ description: "Review a diff." }));
    const first = await packRecipe(recipeDir, {
      outDir: path.join(directory, "dist"),
    });
    const second = await packRecipe(recipeDir, {
      outDir: path.join(directory, "dist"),
    });
    const files = await readRecipeFiles(recipeDir);

    expect(first.integrity).toBe(digestFiles(files));
    expect(second.integrity).toBe(first.integrity);
    expect(first.fileCount).toBe(2);
    expect(first.artifactPath).toBe(
      path.join(directory, "dist", "sample-agent-0.1.0.tgz"),
    );
    const archive = await readFile(first.artifactPath);
    expect(listTarPaths(archive)).toEqual([
      "sample-agent/SKILL.md",
      "sample-agent/promptmarket.yaml",
    ]);
    expect(archive.equals(await readFile(second.artifactPath))).toBe(true);
  });

  test("packing the current directory does not put the archive inside the recipe", async function packsBesideRecipe() {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-pack-cwd-"),
    );
    tempDirs.push(directory);
    const recipeDir = path.join(directory, "sample-agent");
    await writeRecipeDraft(recipeDir, draft({ description: "Review a diff." }));
    const previous = process.cwd();
    process.chdir(recipeDir);
    try {
      const packed = await packRecipe(recipeDir);
      const files = await readRecipeFiles(recipeDir);
      const recipeRoot = await realpath(recipeDir);
      const relative = path.relative(recipeRoot, packed.artifactPath);
      expect(relative.startsWith("..")).toBe(true);
      expect(packed.fileCount).toBe(2);
      expect(
        files.map(function pathOf(file) {
          return file.path;
        }),
      ).toEqual(["SKILL.md", "promptmarket.yaml"]);
    } finally {
      process.chdir(previous);
    }
  });

  test("the published catalog still validates", async function catalogValidates() {
    const scan = await scanRecipes({ recipesDir });
    expect(scan.invalid).toEqual([]);
  });
});
