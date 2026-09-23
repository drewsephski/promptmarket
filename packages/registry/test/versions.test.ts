import {
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
import {
  FileRegistry,
  IntegrityError,
  InvalidRecipeError,
  InvalidRecipeVersionError,
  RecipeVersionNotFoundError,
  installFromLockfile,
  installRecipe,
  type Registry,
} from "../src/index.js";

const recipesDir = path.resolve(import.meta.dirname, "../../../recipes");

const manifest = `schemaVersion: 1
name: sample-recipe
version: 0.1.0
author:
  name: PromptMarket
`;

const skill = `---
name: sample-recipe
description: A sample recipe used to test registry validation.
---

# Sample
`;

function recipeAt(
  version: string,
  body: string,
): { manifest: string; skill: string } {
  return {
    manifest: manifest.replace("version: 0.1.0", `version: ${version}`),
    skill: skill.replace("# Sample", body),
  };
}

describe("immutable versions", function immutableVersions() {
  let tempRoot = "";

  beforeEach(async function createTempRoot() {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "promptmarket-versions-"));
  });

  afterEach(async function removeTempRoot() {
    await rm(tempRoot, { recursive: true, force: true });
  });

  async function writeVersion(
    name: string,
    version: string,
    files: { manifest: string; skill: string },
  ): Promise<void> {
    const directory = path.join(tempRoot, "recipes", name, version);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "promptmarket.yaml"), files.manifest);
    await writeFile(path.join(directory, "SKILL.md"), files.skill);
  }

  test("resolves latest by semver and fetches an exact version", async function resolvesVersions() {
    await writeVersion("sample-recipe", "0.1.0", recipeAt("0.1.0", "# One"));
    await writeVersion("sample-recipe", "0.2.0", recipeAt("0.2.0", "# Two"));
    await writeVersion("sample-recipe", "0.10.0", recipeAt("0.10.0", "# Ten"));
    await writeVersion(
      "sample-recipe",
      "1.0.0-rc.1",
      recipeAt("1.0.0-rc.1", "# Release candidate"),
    );
    const registry = new FileRegistry({
      recipesDir: path.join(tempRoot, "recipes"),
    });

    const latest = await registry.get("sample-recipe");
    const exact = await registry.fetchPackage("sample-recipe", "0.1.0");
    const versions = await registry.listVersions("sample-recipe");

    expect(latest.manifest.version).toBe("1.0.0-rc.1");
    expect(latest.skill.body).toContain("# Release candidate");
    expect(exact.recipe.manifest.version).toBe("0.1.0");
    expect(exact.recipe.skill.body).toContain("# One");
    expect(versions.latest).toBe("1.0.0-rc.1");
    expect(
      versions.versions.map(function versionOf(item) {
        return item.version;
      }),
    ).toEqual(["1.0.0-rc.1", "0.10.0", "0.2.0", "0.1.0"]);
    expect(versions.versions[0]?.integrity).toMatch(/^sha256-/);
    expect(versions.versions[0]?.integrity).not.toBe(
      versions.versions[3]?.integrity,
    );
  });

  test("orders prerelease versions below the final release", async function ordersPrerelease() {
    await writeVersion(
      "sample-recipe",
      "1.0.0-alpha",
      recipeAt("1.0.0-alpha", "# Alpha"),
    );
    await writeVersion(
      "sample-recipe",
      "1.0.0-alpha.1",
      recipeAt("1.0.0-alpha.1", "# Alpha one"),
    );
    await writeVersion(
      "sample-recipe",
      "1.0.0-alpha.beta",
      recipeAt("1.0.0-alpha.beta", "# Alpha beta"),
    );
    await writeVersion("sample-recipe", "1.0.0", recipeAt("1.0.0", "# Final"));
    const registry = new FileRegistry({
      recipesDir: path.join(tempRoot, "recipes"),
    });

    const versions = await registry.listVersions("sample-recipe");

    expect(versions.latest).toBe("1.0.0");
    expect(
      versions.versions.map(function versionOf(item) {
        return item.version;
      }),
    ).toEqual(["1.0.0", "1.0.0-alpha.beta", "1.0.0-alpha.1", "1.0.0-alpha"]);
  });

  test("keeps an invalid sibling version out of latest resolution", async function isolatesInvalidVersion() {
    await writeVersion("sample-recipe", "0.1.0", recipeAt("0.1.0", "# One"));
    const broken = path.join(tempRoot, "recipes", "sample-recipe", "0.2.0");
    await mkdir(broken, { recursive: true });
    await writeFile(
      path.join(broken, "promptmarket.yaml"),
      "schemaVersion: [\n",
    );
    await writeFile(path.join(broken, "SKILL.md"), skill);
    const sourceRoot = path.join(tempRoot, "recipes");
    const registry = new FileRegistry({ recipesDir: sourceRoot });

    const latest = await registry.get("sample-recipe");
    const scan = await registry.scan();
    const historical = await registry.fetchPackage("sample-recipe", "0.1.0");
    const again = await registry.fetchPackage("sample-recipe", "0.1.0");

    expect(latest.manifest.version).toBe("0.1.0");
    expect(
      scan.invalid.map(function pathOf(item) {
        return item.path;
      }),
    ).toContain(broken);
    expect(
      scan.invalid.find(function matches(item) {
        return item.path === broken;
      })?.errors[0]?.code,
    ).toBe("manifest_parse_error");
    expect(historical.integrity).toBe(again.integrity);
    await expect(registry.get("sample-recipe", "0.2.0")).rejects.toBeInstanceOf(
      InvalidRecipeError,
    );
    await expect(registry.get("sample-recipe", "9.9.9")).rejects.toBeInstanceOf(
      RecipeVersionNotFoundError,
    );
    await expect(
      registry.get("sample-recipe", "not-a-version"),
    ).rejects.toBeInstanceOf(InvalidRecipeVersionError);
  });

  test("reports a version directory that is not semver", async function reportsInvalidDirectory() {
    await writeVersion("sample-recipe", "0.1.0", recipeAt("0.1.0", "# One"));
    const notes = path.join(tempRoot, "recipes", "sample-recipe", "notes");
    await mkdir(notes, { recursive: true });
    const registry = new FileRegistry({
      recipesDir: path.join(tempRoot, "recipes"),
    });

    const scan = await registry.scan();
    const latest = await registry.get("sample-recipe");

    expect(latest.manifest.version).toBe("0.1.0");
    expect(scan.invalid).toEqual([
      {
        path: notes,
        errors: [
          {
            code: "invalid_version",
            path: "notes",
            message: 'Version directory "notes" is not a semantic version',
          },
        ],
      },
    ]);
  });

  test("keeps historical github-pr-review bytes distinct from latest", async function preservesHistory() {
    const registry = new FileRegistry({ recipesDir });
    const historical = await registry.fetchPackage("github-pr-review", "0.1.0");
    const latest = await registry.fetchPackage("github-pr-review");
    const versions = await registry.listVersions("github-pr-review");

    expect(historical.recipe.manifest.version).toBe("0.1.0");
    expect(historical.recipe.skill.description).toBe(
      "Review GitHub pull requests for correctness, regressions, security issues, maintainability, and missing tests. Use when asked to inspect or review a pull request.",
    );
    expect(latest.recipe.manifest.version).toBe("0.2.0");
    expect(historical.integrity).not.toBe(latest.integrity);
    expect(versions).toMatchObject({
      name: "github-pr-review",
      latest: "0.2.0",
    });
    expect(
      versions.versions.map(function versionOf(item) {
        return item.version;
      }),
    ).toEqual(["0.2.0", "0.1.0"]);
    expect(
      versions.versions.find(function historicalVersion(item) {
        return item.version === "0.1.0";
      })?.integrity,
    ).toBe(historical.integrity);
  });

  test("installs an exact version and reproduces it from the lockfile", async function installsExactVersion() {
    await writeVersion("sample-recipe", "0.1.0", recipeAt("0.1.0", "# One"));
    await writeVersion("sample-recipe", "0.2.0", recipeAt("0.2.0", "# Two"));
    await writeVersion("other-recipe", "0.3.0", {
      manifest: manifest
        .replace("sample-recipe", "other-recipe")
        .replace("version: 0.1.0", "version: 0.3.0"),
      skill: skill.replaceAll("sample-recipe", "other-recipe"),
    });
    const sourceRoot = path.join(tempRoot, "recipes");
    const projectDir = path.join(tempRoot, "project");
    const registry = new FileRegistry({ recipesDir: sourceRoot });

    const pinned = await installRecipe("sample-recipe@0.1.0", {
      registry,
      projectDir,
    });
    await installRecipe("other-recipe@0.3.0", { registry, projectDir });
    const lockBefore = await readFile(
      path.join(projectDir, "promptmarket.lock"),
      "utf8",
    );
    await rm(path.join(projectDir, ".agents"), {
      recursive: true,
      force: true,
    });
    const restored = await installFromLockfile({
      projectDir,
      recipesDir: sourceRoot,
    });
    const restoredAgain = await installFromLockfile({
      projectDir,
      recipesDir: sourceRoot,
    });
    const lockAfter = await readFile(
      path.join(projectDir, "promptmarket.lock"),
      "utf8",
    );
    const skillText = await readFile(
      path.join(projectDir, ".agents", "skills", "sample-recipe", "SKILL.md"),
      "utf8",
    );

    expect(pinned.version).toBe("0.1.0");
    expect(skillText).toContain("# One");
    expect(skillText).not.toContain("# Two");
    expect(
      restored.map(function nameOf(item) {
        return `${item.name}@${item.version}`;
      }),
    ).toEqual(["other-recipe@0.3.0", "sample-recipe@0.1.0"]);
    expect(
      restoredAgain.map(function integrityOf(item) {
        return item.integrity;
      }),
    ).toEqual(
      restored.map(function integrityOf(item) {
        return item.integrity;
      }),
    );
    expect(lockAfter).toBe(lockBefore);
    await expect(
      stat(path.join(projectDir, "promptmarket.lock.tmp")),
    ).rejects.toThrow();
  });

  test("does not substitute latest when the locked version or integrity differs", async function refusesSubstitution() {
    await writeVersion("sample-recipe", "0.2.0", recipeAt("0.2.0", "# Two"));
    const sourceRoot = path.join(tempRoot, "recipes");
    const projectDir = path.join(tempRoot, "project");
    await mkdir(projectDir, { recursive: true });
    const latest = await new FileRegistry({
      recipesDir: sourceRoot,
    }).fetchPackage("sample-recipe", "0.2.0");

    async function writeLock(
      version: string,
      integrity: string,
    ): Promise<void> {
      await writeFile(
        path.join(projectDir, "promptmarket.lock"),
        `${JSON.stringify(
          {
            lockfileVersion: 1,
            recipes: {
              "sample-recipe": {
                name: "sample-recipe",
                version,
                source: { type: "file" },
                integrity,
              },
            },
          },
          null,
          2,
        )}\n`,
      );
    }

    await writeLock("0.1.0", latest.integrity);
    await expect(
      installFromLockfile({ projectDir, recipesDir: sourceRoot }),
    ).rejects.toBeInstanceOf(RecipeVersionNotFoundError);
    await expect(
      stat(path.join(projectDir, ".agents", "skills", "sample-recipe")),
    ).rejects.toThrow();

    await writeLock("0.2.0", "sha256-eA==");
    await expect(
      installFromLockfile({ projectDir, recipesDir: sourceRoot }),
    ).rejects.toBeInstanceOf(IntegrityError);
    await expect(
      stat(path.join(projectDir, ".agents", "skills", "sample-recipe")),
    ).rejects.toThrow();

    const substituted: Registry = {
      source: { type: "file" },
      async list() {
        return [];
      },
      async get() {
        return latest.recipe;
      },
      async search() {
        return [];
      },
      async fetchPackage() {
        return latest;
      },
      async listVersions() {
        return {
          name: "sample-recipe",
          latest: "0.2.0",
          versions: [{ version: "0.2.0", integrity: latest.integrity }],
        };
      },
    };
    await expect(
      installRecipe("sample-recipe@0.1.0", {
        registry: substituted,
        projectDir,
      }),
    ).rejects.toThrow(/0\.2\.0/);
  });
});
