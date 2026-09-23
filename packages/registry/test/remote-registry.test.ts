import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { LockfileSchema } from "@promptmarket/schema";
import { digestFiles } from "../src/digest.js";
import {
  DEFAULT_REGISTRY_URL,
  FileRegistry,
  MAX_PACKAGE_BYTES,
  MAX_PACKAGE_FILES,
  MAX_RECIPE_PATH_LENGTH,
  MAX_REGISTRY_RESPONSE_BYTES,
  REGISTRY_REQUEST_TIMEOUT_MS,
  RegistryLimitError,
  assertPackageWithinLimits,
  handleRegistryRequest,
  installRecipe,
  IntegrityError,
  RemoteRegistry,
  UnsafeRecipePathError,
  readBoundedBody,
  toPackageResponse,
  validateRecipeTexts,
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
    expect(
      pkg.files.map(function pathOf(file) {
        return file.path;
      }),
    ).toEqual(["SKILL.md", "promptmarket.yaml"]);
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

    const packaged = await handleRegistryRequest(
      new FileRegistry({ recipesDir }),
      new Request(`${registryBase}/recipes/github-pr-review/package`),
    );
    const packageBody = (await packaged.json()) as {
      integrity: string;
      files: Array<{ path: string; encoding: string; content: string }>;
    };
    expect(packageBody.integrity).toBe(pkg.integrity);
    expect(
      packageBody.files.map(function describeFile(file) {
        return { path: file.path, encoding: file.encoding };
      }),
    ).toEqual([
      { path: "SKILL.md", encoding: "utf8" },
      { path: "promptmarket.yaml", encoding: "utf8" },
    ]);
  });

  test("installs a remote package without a local recipe path", async function installsRemote() {
    const projectDir = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-remote-"),
    );
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
      JSON.parse(
        await readFile(path.join(projectDir, "promptmarket.lock"), "utf8"),
      ),
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
    const remote = new RemoteRegistry(registryBase, async function fetchBad(
      input,
    ) {
      const url = String(input);
      if (url.endsWith("/package")) {
        return Response.json({
          name: "github-pr-review",
          version: "0.1.0",
          integrity: "sha256-eA==",
          files: [
            { path: "SKILL.md", encoding: "utf8", content: "# nope\n" },
            { path: "../secret.txt", encoding: "utf8", content: "nope\n" },
          ],
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    await expect(
      remote.fetchPackage("github-pr-review"),
    ).rejects.toBeInstanceOf(UnsafeRecipePathError);

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
              encoding: "utf8",
              content:
                "schemaVersion: 1\nname: sample-recipe\nversion: 0.1.0\nauthor:\n  name: PromptMarket\n",
            },
            {
              path: "SKILL.md",
              encoding: "utf8",
              content:
                "---\nname: sample-recipe\ndescription: A sample recipe used to test registry validation.\n---\n\n# Sample\n",
            },
          ],
        });
      },
    );

    await expect(
      mismatched.fetchPackage("sample-recipe"),
    ).rejects.toBeInstanceOf(IntegrityError);
  });

  test("rejects a registry payload that does not match the schema", async function rejectsSchema() {
    const remote = new RemoteRegistry(
      registryBase,
      async function fetchInvalid() {
        return Response.json({ recipes: [{ name: "not-a-summary" }] });
      },
    );

    await expect(remote.list()).rejects.toThrow(/Invalid registry response/);
    expect(new RemoteRegistry().source).toEqual({
      type: "registry",
      url: DEFAULT_REGISTRY_URL,
    });
    expect(() => new RemoteRegistry("not a url")).toThrow(
      /Invalid registry URL/,
    );
    expect(() => new RemoteRegistry("file:///tmp/recipes")).toThrow(
      /Invalid registry URL/,
    );
  });

  test("round-trips binary files as base64 and keeps the byte digest", async function roundTripsBinary() {
    const binary = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00,
    ]);
    const manifest = [
      "schemaVersion: 1",
      "name: sample-recipe",
      "version: 0.1.0",
      "author:",
      "  name: PromptMarket",
      "compatibility:",
      "  - generic",
      "requires:",
      "  mcp: []",
      "capabilities:",
      "  filesystem: none",
      "  network: []",
      "  shell: false",
      "entrypoint: SKILL.md",
      "tags: []",
      "",
    ].join("\n");
    const skill = [
      "---",
      "name: sample-recipe",
      "description: A sample recipe used to test registry validation.",
      "---",
      "",
      "# Sample",
      "",
    ].join("\n");
    const validated = validateRecipeTexts("sample-recipe", manifest, skill);
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      return;
    }

    const files = [
      {
        path: "promptmarket.yaml",
        contents: new TextEncoder().encode(manifest),
      },
      { path: "SKILL.md", contents: new TextEncoder().encode(skill) },
      { path: "assets/logo.png", contents: binary },
    ];
    const integrity = digestFiles(files);
    const response = toPackageResponse({
      recipe: validated.recipe,
      files,
      integrity,
    });
    const logo = response.files.find(function isLogo(file) {
      return file.path === "assets/logo.png";
    });
    expect(logo).toEqual({
      path: "assets/logo.png",
      encoding: "base64",
      content: Buffer.from(binary).toString("base64"),
    });

    const remote = new RemoteRegistry(
      registryBase,
      async function fetchPackage() {
        return Response.json(response);
      },
    );
    const fetched = await remote.fetchPackage("sample-recipe");
    const fetchedLogo = fetched.files.find(function isLogo(file) {
      return file.path === "assets/logo.png";
    });

    expect(Array.from(fetchedLogo?.contents ?? [])).toEqual(Array.from(binary));
    expect(fetched.integrity).toBe(integrity);
  });

  test("rejects invalid base64, oversized packages, and long paths", async function rejectsHostilePackages() {
    const invalidBase64 = new RemoteRegistry(
      registryBase,
      async function fetchInvalidBase64() {
        return Response.json({
          name: "sample-recipe",
          version: "0.1.0",
          integrity: "sha256-eA==",
          files: [
            {
              path: "assets/logo.png",
              encoding: "base64",
              content: "!!!!",
            },
          ],
        });
      },
    );
    await expect(invalidBase64.fetchPackage("sample-recipe")).rejects.toThrow(
      /Invalid base64 recipe file: assets\/logo.png/,
    );

    const tooMany = new RemoteRegistry(
      registryBase,
      async function fetchTooMany() {
        return Response.json({
          name: "sample-recipe",
          version: "0.1.0",
          integrity: "sha256-eA==",
          files: Array.from(
            { length: MAX_PACKAGE_FILES + 1 },
            function fileAt(index) {
              return {
                path: `notes/file-${index}.txt`,
                encoding: "utf8",
                content: "x",
              };
            },
          ),
        });
      },
    );
    await expect(tooMany.fetchPackage("sample-recipe")).rejects.toBeInstanceOf(
      RegistryLimitError,
    );

    expect(function oversized() {
      assertPackageWithinLimits(
        [
          {
            path: "assets/logo.png",
            contents: Uint8Array.from([1, 2, 3, 4, 5]),
          },
        ],
        { maxBytes: 4 },
      );
    }).toThrow(RegistryLimitError);
    expect(function withinLimit() {
      assertPackageWithinLimits(
        [
          {
            path: "assets/logo.png",
            contents: Uint8Array.from([1, 2, 3, 4]),
          },
        ],
        { maxBytes: 4 },
      );
    }).not.toThrow();

    const remote = new RemoteRegistry(
      registryBase,
      async function fetchLongPath() {
        return Response.json({
          name: "sample-recipe",
          version: "0.1.0",
          integrity: "sha256-eA==",
          files: [
            {
              path: "a".repeat(MAX_RECIPE_PATH_LENGTH + 1),
              encoding: "utf8",
              content: "x",
            },
          ],
        });
      },
    );
    await expect(remote.fetchPackage("sample-recipe")).rejects.toBeInstanceOf(
      UnsafeRecipePathError,
    );
  });

  test("bounds registry responses and times out requests", async function boundsResponses() {
    expect(REGISTRY_REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(MAX_PACKAGE_BYTES).toBe(20 * 1024 * 1024);

    const oversized = new RemoteRegistry(
      registryBase,
      async function fetchHuge() {
        return new Response("[]", {
          status: 200,
          headers: {
            "content-length": String(MAX_REGISTRY_RESPONSE_BYTES + 1),
          },
        });
      },
    );
    await expect(oversized.list()).rejects.toBeInstanceOf(RegistryLimitError);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("abcdefghij"));
        controller.close();
      },
    });
    await expect(
      readBoundedBody(new Response(stream), 4),
    ).rejects.toBeInstanceOf(RegistryLimitError);

    const captured: { signal?: AbortSignal } = {};
    const remote = new RemoteRegistry(registryBase, async function fetchSignal(
      _input,
      init,
    ) {
      if (init?.signal) {
        captured.signal = init.signal;
      }
      return Response.json({ recipes: [] });
    });
    await expect(remote.list()).resolves.toEqual([]);
    if (!captured.signal) {
      throw new Error("registry request did not set an abort signal");
    }
    expect(captured.signal.aborted).toBe(false);
  });
});
