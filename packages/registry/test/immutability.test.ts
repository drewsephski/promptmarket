import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";
import {
  checkRecipeRepository,
  diffRecipeVersions,
  writeRecipeDraft,
  type RecipeDraft,
  type RecipeVersionFiles,
} from "../src/index.js";

const exec = promisify(execFile);

function files(
  name: string,
  version: string,
  body: string,
): RecipeVersionFiles {
  return {
    name,
    version,
    files: [
      {
        path: "SKILL.md",
        contents: new TextEncoder().encode(body),
      },
    ],
  };
}

function draft(version: string): RecipeDraft {
  return {
    name: "sample-agent",
    version,
    description: "Review a local diff.",
    author: { name: "Ada Lovelace" },
    compatibility: ["cursor"],
    tags: ["review"],
    requires: { mcp: [] },
    capabilities: { filesystem: "none", shell: false, network: [] },
    instructions: `# Sample Agent ${version}\n\nRead the diff.\n`,
  };
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await exec("git", args, { cwd });
  return result.stdout.trim();
}

describe("recipe immutability", function recipeImmutability() {
  const tempDirs: string[] = [];

  afterEach(async function cleanup() {
    await Promise.all(
      tempDirs.splice(0).map(function remove(directory) {
        return rm(directory, { recursive: true, force: true });
      }),
    );
  });

  test("allows a new version and rejects edits, deletions, and renames", function diffsVersions() {
    const base = [files("sample-agent", "0.1.0", "original")];
    expect(
      diffRecipeVersions(base, [
        files("sample-agent", "0.1.0", "original"),
        files("sample-agent", "0.2.0", "next"),
      ]),
    ).toEqual([]);
    expect(
      diffRecipeVersions(base, [files("sample-agent", "0.1.0", "changed")]),
    ).toEqual([
      expect.objectContaining({ code: "version_modified", version: "0.1.0" }),
    ]);
    expect(diffRecipeVersions(base, [])).toEqual([
      expect.objectContaining({ code: "version_deleted", version: "0.1.0" }),
    ]);
    expect(
      diffRecipeVersions(base, [files("sample-agent", "0.2.0", "renamed")]),
    ).toEqual([
      expect.objectContaining({ code: "version_renamed", version: "0.1.0" }),
    ]);
  });

  test("checks fixture git history", async function checksHistory() {
    const repo = await mkdtemp(path.join(import.meta.dirname, ".tmp-git-"));
    tempDirs.push(repo);
    await git(repo, ["init", "--template="]);
    await git(repo, ["config", "user.email", "tests@example.com"]);
    await git(repo, ["config", "user.name", "PromptMarket Tests"]);
    await writeRecipeDraft(
      path.join(repo, "recipes", "sample-agent", "0.1.0"),
      draft("0.1.0"),
    );
    await git(repo, ["add", "recipes"]);
    await git(repo, ["commit", "-m", "Add sample-agent@0.1.0"]);
    const base = await git(repo, ["rev-parse", "HEAD"]);

    await writeRecipeDraft(
      path.join(repo, "recipes", "sample-agent", "0.2.0"),
      draft("0.2.0"),
    );
    expect(await checkRecipeRepository({ repoDir: repo, base })).toEqual({
      ok: true,
    });

    await writeFile(
      path.join(repo, "recipes", "sample-agent", "0.1.0", "SKILL.md"),
      "changed\n",
    );
    const edited = await checkRecipeRepository({ repoDir: repo, base });
    expect(edited.ok).toBe(false);
    if (edited.ok) {
      return;
    }
    expect(edited.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "version_modified" }),
      ]),
    );

    await writeRecipeDraft(
      path.join(repo, "recipes", "sample-agent", "0.1.0"),
      draft("0.1.0"),
    );
    await rm(path.join(repo, "recipes", "sample-agent", "0.1.0"), {
      recursive: true,
    });
    const deleted = await checkRecipeRepository({ repoDir: repo, base });
    expect(deleted.ok).toBe(false);
    if (deleted.ok) {
      return;
    }
    expect(deleted.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "version_renamed" }),
      ]),
    );

    await rm(path.join(repo, "recipes", "sample-agent", "0.2.0"), {
      recursive: true,
    });
    const removed = await checkRecipeRepository({ repoDir: repo, base });
    expect(removed.ok).toBe(false);
    if (removed.ok) {
      return;
    }
    expect(removed.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "version_deleted" }),
      ]),
    );

    await writeRecipeDraft(
      path.join(repo, "recipes", "sample-agent", "0.1.0"),
      draft("0.1.0"),
    );
    await mkdir(path.join(repo, "recipes", "sample-agent", "0.3.0"), {
      recursive: true,
    });
    await writeFile(
      path.join(repo, "recipes", "sample-agent", "0.3.0", "SKILL.md"),
      "no manifest\n",
    );
    const invalid = await checkRecipeRepository({ repoDir: repo, base });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) {
      return;
    }
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "manifest_missing" }),
      ]),
    );
  });
});
