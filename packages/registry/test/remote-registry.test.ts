import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { LockfileSchema } from "@promptmarket/schema";
import {
  DEFAULT_REGISTRY_URL,
  FileRegistry,
  handleRegistryRequest,
  installRecipe,
  IntegrityError,
  RemoteRegistry,
  UnsafeRecipePathError,
  type Registry,
} from "../src/index.js";

const recipesDir = path.resolve(import.meta.dirname, "../../../recipes");
const registryBase = "http://registry.test/api/registry/v1";

function registryFetch(registry: Registry): typeof fetch {
  return function fetchRegistry(input) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    return handleRegistryRequest(registry, new Request(url));
  };
}

describe("remote registry", function remoteRegistry() {
  const tempDirs: string[] = [];

  afterEach(async function cleanup() {
    await Promise.all(
      tempDirs.splice(0).map(function removeDir(directory) {
        return rm(directory, { recursive: true, force: true });
      }),
    );
  });

  test("reads summaries, details, and packages through the registry API", async function readsApi() {
    const remote = new RemoteRegistry(
      registryBase,
      registryFetch(new FileRegistry({ recipesDir })),
    );

    const summaries = await remote.search("review a pull request");
    const recipe = await remote.get("github-pr-review");
    const pkg = await remote.fetchPackage("github-pr-review");
    const detail = await handleRegistryRequest(
      new FileRegistry({ recipesDir }),
      new Request(`${registryBase}/recipes/github-pr-review`),
    );
    const body = (await detail.json()) as {
      name: string;
      version: string;
      description: string;
      author: { name: string };
      compatibility: string[];
      requires: { mcp: string[] };
      capabilities: { filesystem: string; network: string[]; shell: boolean };
      tags: string[];
      integrity: string;
      skill: { body: string };
    };

    expect(remote.source).toEqual({ type: "registry", url: registryBase });
    expect(summaries).toEqual([
      {
        name: "github-pr-review",
        version: "0.1.0",
        description: recipe.skill.description,
        tags: ["github", "pull-request", "code-review"],
        compatibility: ["cursor", "claude-code", "codex", "generic"],
      },
    ]);
    expect(recipe.skill.body).toContain("# GitHub Pull Request Review");
    expect(recipe).not.toHaveProperty("path");
    expect(pkg.integrity).toMatch(/^sha256-/);
    expect(pkg.files.map(function pathOf(file) {
      return file.path;
    })).toEqual(["SKILL.md", "promptmarket.yaml"]);
    expect(body).toMatchObject({
      name: "github-pr-review",
      version: "0.1.0",
      description: recipe.skill.description,
      author: { name: "PromptMarket" },
      compatibility: ["cursor", "claude-code", "codex", "generic"],
      requires: { mcp: ["io.github.github/github-mcp-server"] },
      capabilities: {
        filesystem: "read",
        network: ["github.com"],
        shell: false,
      },
      tags: ["github", "pull-request", "code-review"],
      integrity: pkg.integrity,
    });
    expect(body.skill.body).toContain("# GitHub Pull Request Review");
  });

  test("installs a remote package without a local recipe path", async function installsRemote() {
    const projectDir = await mkdtemp(path.join(os.tmpdir(), "promptmarket-remote-"));
    tempDirs.push(projectDir);
    const remote = new RemoteRegistry(
      `${registryBase}/`,
      registryFetch(new FileRegistry({ recipesDir })),
    );

    const installed = await installRecipe("github-pr-review", {
      registry: remote,
      projectDir,
    });
    const skill = await readFile(
      path.join(installed.destination, "SKILL.md"),
      "utf8",
    );
    const lock = LockfileSchema.parse(
      JSON.parse(await readFile(path.join(projectDir, "promptmarket.lock"), "utf8")),
    );

    expect(skill).toContain("name: github-pr-review");
    expect(installed.source).toEqual({ type: "registry", url: registryBase });
    expect(lock.recipes["github-pr-review"]).toEqual({
      name: "github-pr-review",
      version: "0.1.0",
      source: { type: "registry", url: registryBase },
      integrity: installed.integrity,
    });
  });

  test("rejects a package whose integrity or path does not match its bytes", async function rejectsUntrustedPackage() {
    const remote = new RemoteRegistry(registryBase, async function fetchBad(input) {
      const url = String(input);
      if (url.endsWith("/package")) {
        return Response.json({
          name: "github-pr-review",
          version: "0.1.0",
          integrity: "sha256-eA==",
          files: [
            { path: "SKILL.md", content: "# nope\n" },
            { path: "../secret.txt", content: "nope\n" },
          ],
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    await expect(remote.fetchPackage("github-pr-review")).rejects.toBeInstanceOf(
      UnsafeRecipePathError,
    );

    const mismatched = new RemoteRegistry(
      registryBase,
      async function fetchMismatch() {
        return Response.json({
          name: "sample-recipe",
          version: "0.1.0",
          integrity: "sha256-eA==",
          files: [
            {
              path: "promptmarket.yaml",
              content:
                "schemaVersion: 1\nname: sample-recipe\nversion: 0.1.0\nauthor:\n  name: PromptMarket\n",
            },
            {
              path: "SKILL.md",
              content:
                "---\nname: sample-recipe\ndescription: A sample recipe used to test registry validation.\n---\n\n# Sample\n",
            },
          ],
        });
      },
    );

    await expect(mismatched.fetchPackage("sample-recipe")).rejects.toBeInstanceOf(
      IntegrityError,
    );
  });

  test("rejects a registry payload that does not match the schema", async function rejectsSchema() {
    const remote = new RemoteRegistry(registryBase, async function fetchInvalid() {
      return Response.json({ recipes: [{ name: "not-a-summary" }] });
    });

    await expect(remote.list()).rejects.toThrow(/Invalid registry response/);
    expect(new RemoteRegistry().source).toEqual({
      type: "registry",
      url: DEFAULT_REGISTRY_URL,
    });
    expect(() => new RemoteRegistry("not a url")).toThrow(/Invalid registry URL/);
  });
});
