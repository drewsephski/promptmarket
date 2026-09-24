import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  contentMeta,
  handleContentRequest,
  loadContentCatalog,
  resolveContentDir,
} from "@promptmarket/content";
import { FileRegistry, handleRegistryRequest } from "@promptmarket/registry";
import { createRegistry, run, type CliIo } from "../src/program.js";

const recipesDir = path.resolve(import.meta.dirname, "../../../recipes");
const fixture = path.join(recipesDir, "github-pr-review", "0.1.0");

function captureIo(): CliIo & { out: () => string; err: () => string } {
  let stdout = "";
  let stderr = "";
  return {
    stdout: function writeStdout(message: string) {
      stdout += message;
    },
    stderr: function writeStderr(message: string) {
      stderr += message;
    },
    out: function readStdout() {
      return stdout;
    },
    err: function readStderr() {
      return stderr;
    },
  };
}

describe("promptmarket cli", function promptmarketCli() {
  const tempDirs: string[] = [];

  afterEach(async function cleanup() {
    await Promise.all(
      tempDirs.splice(0).map(function removeDir(directory) {
        return rm(directory, { recursive: true, force: true });
      }),
    );
  });

  test("search --json finds github-pr-review", async function searchesJson() {
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "search",
        "review pull request",
        "--json",
        "--offline",
        "--recipes",
        recipesDir,
      ],
      io,
    );
    const payload = JSON.parse(io.out()) as {
      ok: boolean;
      recipes: Array<{ name: string; description: string }>;
    };

    expect(exitCode).toBe(0);
    expect(io.err()).toBe("");
    expect(payload.ok).toBe(true);
    expect(
      payload.recipes.map(function nameOf(recipe) {
        return recipe.name;
      }),
    ).toEqual(["github-pr-review"]);
    expect(payload.recipes[0]?.description).toContain("pull request");
  });

  test("search groups guides, lessons, prompts, and skills", async function searchesCatalog() {
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "search",
        "tool calling convex",
        "--offline",
        "--recipes",
        recipesDir,
      ],
      io,
    );

    expect(exitCode).toBe(0);
    const output = io.out();
    expect(output.indexOf("GUIDES")).toBeLessThan(output.indexOf("LESSONS"));
    expect(output.indexOf("LESSONS")).toBeLessThan(output.indexOf("PROMPTS"));
    expect(output).toContain("ai-project-manager-convex");
    expect(output).toContain("tool-calling");
    expect(output).toContain("safe-tool-calling-system");
    expect(output).toContain("tool-selection-router");
  });

  test("context --json assembles a feature", async function buildsContext() {
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "context",
        "I'm building a RAG feature in Next.js with Neon",
        "--json",
        "--offline",
        "--recipes",
        recipesDir,
      ],
      io,
    );
    const payload = JSON.parse(io.out()) as {
      ok: boolean;
      topics: Array<{ slug: string }>;
      prompts: Array<{ name: string; body: string }>;
      guides: Array<{ slug: string }>;
    };

    expect(exitCode).toBe(0);
    expect(payload.ok).toBe(true);
    expect(payload.topics[0]?.slug).toBe("rag");
    expect(payload.prompts[0]?.name).toBe("rag-grounded-answer");
    expect(payload.prompts[0]?.body.length).toBeGreaterThan(0);
    expect(payload.guides[0]?.slug).toBe("rag-knowledge-base");
  });

  test("info --json prints the recipe", async function printsInfo() {
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "info",
        "github-pr-review",
        "--json",
        "--recipes",
        recipesDir,
      ],
      io,
    );
    const payload = JSON.parse(io.out()) as {
      ok: boolean;
      recipe: {
        name: string;
        version: string;
        requires: { mcp: string[] };
        skill: { body: string };
      };
    };

    expect(exitCode).toBe(0);
    expect(payload).toMatchObject({
      ok: true,
      recipe: {
        name: "github-pr-review",
        version: "0.2.0",
        requires: { mcp: ["io.github.github/github-mcp-server"] },
      },
    });
    expect(payload.recipe.skill.body).toContain("# GitHub Pull Request Review");
  });

  test("validate --json accepts the fixture", async function validatesFixture() {
    const io = captureIo();
    const exitCode = await run(
      ["node", "promptmarket", "validate", fixture, "--json"],
      io,
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(io.out())).toEqual({
      ok: true,
      name: "github-pr-review",
      version: "0.1.0",
    });
  });

  test("validate --json rejects a missing recipe", async function rejectsMissingRecipe() {
    const io = captureIo();
    const missing = path.join(os.tmpdir(), "promptmarket-missing-recipe");
    const exitCode = await run(
      ["node", "promptmarket", "validate", missing, "--json"],
      io,
    );
    const payload = JSON.parse(io.out()) as {
      ok: boolean;
      errors: Array<{ code: string }>;
    };

    expect(exitCode).toBe(1);
    expect(payload.ok).toBe(false);
    expect(
      payload.errors.map(function codeOf(error) {
        return error.code;
      }),
    ).toEqual(["manifest_missing", "skill_missing"]);
  });

  test("add --json installs the recipe into the project", async function addsRecipe() {
    const projectDir = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-cli-"),
    );
    tempDirs.push(projectDir);
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "add",
        "github-pr-review",
        "--json",
        "--recipes",
        recipesDir,
        "--project",
        projectDir,
      ],
      io,
    );
    const payload = JSON.parse(io.out()) as {
      ok: boolean;
      installed: { integrity: string; destination: string; version: string };
    };
    const skill = await readFile(
      path.join(
        projectDir,
        ".agents",
        "skills",
        "github-pr-review",
        "SKILL.md",
      ),
      "utf8",
    );
    const lock = JSON.parse(
      await readFile(path.join(projectDir, "promptmarket.lock"), "utf8"),
    ) as {
      recipes: Record<string, { version: string; integrity: string }>;
    };

    expect(exitCode).toBe(0);
    expect(payload.ok).toBe(true);
    expect(payload.installed.version).toBe("0.2.0");
    expect(payload.installed.integrity).toMatch(/^sha256-/);
    expect(skill).toContain("name: github-pr-review");
    expect(lock.recipes["github-pr-review"]?.integrity).toBe(
      payload.installed.integrity,
    );
  });

  test("defaults to the hosted registry and lets --recipes win", function choosesRegistry() {
    expect(createRegistry({}).source).toEqual({
      type: "registry",
      url: "https://promptmarket.sh/api/registry/v1",
    });
    expect(createRegistry({ recipes: recipesDir }).source).toEqual({
      type: "file",
    });
    expect(
      createRegistry({
        recipes: recipesDir,
        registry: "http://127.0.0.1:9/api/registry/v1",
      }).source,
    ).toEqual({ type: "file" });
    expect(
      createRegistry({ registry: "http://127.0.0.1:9/api/registry/v1" }).source,
    ).toEqual({
      type: "registry",
      url: "http://127.0.0.1:9/api/registry/v1",
    });
  });

  test("add --registry installs into a project with no local recipes", async function addsFromRegistry() {
    const projectDir = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-remote-cli-"),
    );
    tempDirs.push(projectDir);
    const registry = new FileRegistry({ recipesDir });
    const server = createServer(function handle(request, response) {
      const host = request.headers.host ?? "127.0.0.1";
      const url = `http://${host}${request.url ?? "/"}`;
      handleRegistryRequest(
        registry,
        new Request(url, { method: request.method }),
      )
        .then(async function write(result) {
          const body = Buffer.from(await result.arrayBuffer());
          response.writeHead(result.status, {
            "content-type": "application/json",
          });
          response.end(body);
        })
        .catch(function fail(error: unknown) {
          response.writeHead(500);
          response.end(error instanceof Error ? error.message : "error");
        });
    });
    await new Promise<void>(function listen(resolve) {
      server.listen(0, "127.0.0.1", function listening() {
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Registry test server did not bind a port");
    }

    try {
      const io = captureIo();
      const exitCode = await run(
        [
          "node",
          "promptmarket",
          "add",
          "github-pr-review",
          "--json",
          "--registry",
          `http://127.0.0.1:${address.port}/api/registry/v1`,
          "--project",
          projectDir,
        ],
        io,
      );
      const skill = await readFile(
        path.join(
          projectDir,
          ".agents",
          "skills",
          "github-pr-review",
          "SKILL.md",
        ),
        "utf8",
      );
      const lock = JSON.parse(
        await readFile(path.join(projectDir, "promptmarket.lock"), "utf8"),
      ) as {
        recipes: Record<string, { source: { type: string; url?: string } }>;
      };

      expect(exitCode).toBe(0);
      expect(io.err()).toBe("");
      expect(skill).toContain("name: github-pr-review");
      expect(lock.recipes["github-pr-review"]?.source).toEqual({
        type: "registry",
        url: `http://127.0.0.1:${address.port}/api/registry/v1`,
      });
    } finally {
      await new Promise<void>(function close(resolve, reject) {
        server.close(function closed(error) {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  test("versions, exact info, exact add, and install round-trip", async function versionsAndInstall() {
    const projectDir = await mkdtemp(
      path.join(os.tmpdir(), "promptmarket-install-"),
    );
    tempDirs.push(projectDir);
    const versionsIo = captureIo();
    const versionsExit = await run(
      [
        "node",
        "promptmarket",
        "versions",
        "github-pr-review",
        "--json",
        "--recipes",
        recipesDir,
      ],
      versionsIo,
    );
    const versions = JSON.parse(versionsIo.out()) as {
      ok: boolean;
      latest: string;
      versions: Array<{ version: string }>;
    };
    expect(versionsExit).toBe(0);
    expect(versions.latest).toBe("0.2.0");
    expect(
      versions.versions.map(function versionOf(item) {
        return item.version;
      }),
    ).toEqual(["0.2.0", "0.1.0"]);

    const infoIo = captureIo();
    const infoExit = await run(
      [
        "node",
        "promptmarket",
        "info",
        "github-pr-review@0.1.0",
        "--json",
        "--recipes",
        recipesDir,
      ],
      infoIo,
    );
    expect(infoExit).toBe(0);
    expect(JSON.parse(infoIo.out())).toMatchObject({
      ok: true,
      recipe: { version: "0.1.0" },
    });

    const addIo = captureIo();
    const addExit = await run(
      [
        "node",
        "promptmarket",
        "add",
        "github-pr-review@0.1.0",
        "--json",
        "--recipes",
        recipesDir,
        "--project",
        projectDir,
      ],
      addIo,
    );
    const added = JSON.parse(addIo.out()) as {
      installed: { version: string; integrity: string };
    };
    expect(addExit).toBe(0);
    expect(added.installed.version).toBe("0.1.0");
    const lockBefore = await readFile(
      path.join(projectDir, "promptmarket.lock"),
      "utf8",
    );
    await rm(path.join(projectDir, ".agents"), {
      recursive: true,
      force: true,
    });

    const installIo = captureIo();
    const installExit = await run(
      [
        "node",
        "promptmarket",
        "install",
        "--json",
        "--recipes",
        recipesDir,
        "--project",
        projectDir,
      ],
      installIo,
    );
    const installed = JSON.parse(installIo.out()) as {
      ok: boolean;
      installed: Array<{ version: string; integrity: string }>;
    };
    const skill = await readFile(
      path.join(
        projectDir,
        ".agents",
        "skills",
        "github-pr-review",
        "SKILL.md",
      ),
      "utf8",
    );
    const lockAfter = await readFile(
      path.join(projectDir, "promptmarket.lock"),
      "utf8",
    );

    expect(installExit).toBe(0);
    expect(installed.ok).toBe(true);
    expect(installed.installed[0]?.version).toBe("0.1.0");
    expect(installed.installed[0]?.integrity).toBe(added.installed.integrity);
    expect(skill).toContain(
      "Use when asked to inspect or review a pull request.",
    );
    expect(skill).not.toContain("Classify blocking findings");
    expect(lockAfter).toBe(lockBefore);
    await expect(
      stat(path.join(projectDir, "promptmarket.lock.tmp")),
    ).rejects.toThrow();
  });

  test("rejects a malformed recipe reference", async function rejectsBadReference() {
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "add",
        "github-pr-review@banana",
        "--json",
        "--recipes",
        recipesDir,
      ],
      io,
    );
    const payload = JSON.parse(io.out()) as { ok: boolean; error: string };

    expect(exitCode).toBe(1);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Invalid recipe reference");
  });

  test("prints human version output", async function printsVersions() {
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "versions",
        "github-pr-review",
        "--recipes",
        recipesDir,
      ],
      io,
    );

    expect(exitCode).toBe(0);
    expect(io.out()).toContain("latest: 0.2.0\n");
    expect(io.out()).toContain("0.1.0\tsha256-");
    expect(io.err()).toBe("");
  });

  test("show and learn print prompt content", async function showsPromptAndLesson() {
    const io = captureIo();
    const shown = await run(
      ["node", "promptmarket", "show", "structured-data-extractor", "--json", "--offline"],
      io,
    );
    const shownPayload = JSON.parse(io.out()) as {
      ok: boolean;
      kind: string;
      prompt: { name: string; body: string; variables: string[] };
    };
    const learnIo = captureIo();
    const learned = await run(
      ["node", "promptmarket", "learn", "rag", "--json", "--offline"],
      learnIo,
    );
    const lesson = JSON.parse(learnIo.out()) as {
      ok: boolean;
      topic: { slug: string; url: string };
    };

    expect(shown).toBe(0);
    expect(shownPayload.kind).toBe("prompt");
    expect(shownPayload.prompt.name).toBe("structured-data-extractor");
    expect(shownPayload.prompt.variables).toContain("input");
    expect(shownPayload.prompt.body).toContain("{{schema}}");
    expect(learned).toBe(0);
    expect(lesson.topic.slug).toBe("rag");
    expect(lesson.topic.url).toBe("https://promptmarket.sh/learn/rag");

    const guidesIo = captureIo();
    const guidesExit = await run(
      ["node", "promptmarket", "guides", "--json", "--offline"],
      guidesIo,
    );
    const guides = JSON.parse(guidesIo.out()) as {
      ok: boolean;
      guides: Array<{ slug: string }>;
    };
    const guideIo = captureIo();
    const guideExit = await run(
      ["node", "promptmarket", "guide", "ai-product-brief-builder", "--json", "--offline"],
      guideIo,
    );
    const guide = JSON.parse(guideIo.out()) as {
      ok: boolean;
      guide: { slug: string; url: string; sections: Array<{ title: string }> };
    };

    expect(guidesExit).toBe(0);
    expect(
      guides.guides.map(function slugOf(item) {
        return item.slug;
      }),
    ).toEqual([
      "ai-product-brief-builder",
      "rag-knowledge-base",
      "ai-project-manager-convex",
    ]);
    expect(guideExit).toBe(0);
    expect(guide.guide.slug).toBe("ai-product-brief-builder");
    expect(guide.guide.url).toBe(
      "https://promptmarket.sh/guides/ai-product-brief-builder",
    );
    expect(guide.guide.sections.length).toBeGreaterThan(5);
  });

  test("detect prints a project fingerprint and ignores env files", async function detectsProject() {
    const directory = await mkdtemp(path.join(os.tmpdir(), "promptmarket-detect-"));
    tempDirs.push(directory);
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        packageManager: "pnpm@11.0.0",
        dependencies: {
          next: "16.0.0",
          ai: "6.0.0",
          "@openrouter/ai-sdk-provider": "2.0.0",
          "@neondatabase/serverless": "1.0.0",
          "drizzle-orm": "0.44.0",
          zod: "4.0.0",
          tailwindcss: "4.0.0",
        },
        devDependencies: { typescript: "7.0.0" },
      }),
    );
    await writeFile(path.join(directory, "tsconfig.json"), "{}");
    await writeFile(path.join(directory, ".env"), "OPENROUTER_API_KEY=secret\n");
    const io = captureIo();
    const exitCode = await run(
      ["node", "promptmarket", "detect", directory],
      io,
    );

    expect(exitCode).toBe(0);
    expect(io.out()).toContain("Framework       Next.js 16");
    expect(io.out()).toContain("Language        TypeScript");
    expect(io.out()).toContain("Package manager pnpm");
    expect(io.out()).toContain("OpenRouter");
    expect(io.out()).toContain("Neon");
    expect(io.out()).toContain("Drizzle");
    expect(io.out()).toContain("Zod");
    expect(io.out()).not.toContain("secret");
  });

  test("context --project prefers the stack without overriding intent", async function projectContext() {
    const directory = await mkdtemp(path.join(os.tmpdir(), "promptmarket-project-"));
    tempDirs.push(directory);
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        dependencies: {
          next: "16.0.0",
          "@neondatabase/serverless": "1.0.0",
          "drizzle-orm": "0.44.0",
        },
      }),
    );
    const io = captureIo();
    const exitCode = await run(
      [
        "node",
        "promptmarket",
        "context",
        "add a knowledge base",
        "--project",
        directory,
        "--json",
        "--offline",
        "--recipes",
        recipesDir,
      ],
      io,
    );
    const payload = JSON.parse(io.out()) as {
      guides: Array<{ slug: string }>;
      primary?: { guide?: string };
      matches?: Array<{ kind: string; name: string; reasons: string[] }>;
      projectNotes?: Array<{ status: string; label: string }>;
    };
    const convexIo = captureIo();
    const convexExit = await run(
      [
        "node",
        "promptmarket",
        "context",
        "teach me Convex tool calling",
        "--project",
        directory,
        "--json",
        "--offline",
        "--recipes",
        recipesDir,
      ],
      convexIo,
    );
    const convex = JSON.parse(convexIo.out()) as {
      guides: Array<{ slug: string }>;
    };

    expect(exitCode).toBe(0);
    expect(payload.guides[0]?.slug).toBe("rag-knowledge-base");
    expect(payload.primary?.guide).toBe("rag-knowledge-base");
    expect(
      payload.matches?.find(function guide(match) {
        return match.kind === "guide";
      })?.reasons,
    ).toEqual(expect.arrayContaining(["Project uses Neon", "Project uses Drizzle"]));
    expect(payload.projectNotes).toEqual(
      expect.arrayContaining([
        { status: "detected", label: "Drizzle" },
        { status: "required", label: "pgvector" },
        { status: "required", label: "embedding model" },
      ]),
    );
    expect(payload.projectNotes?.some(function missing(note) {
      return note.status === "missing";
    })).toBe(false);
    expect(convexExit).toBe(0);
    expect(convex.guides[0]?.slug).toBe("ai-project-manager-convex");
  });

  test("doctor compares package versions and context --format agent is markdown", async function doctorAndAgent() {
    const directory = await mkdtemp(path.join(os.tmpdir(), "promptmarket-doctor-"));
    tempDirs.push(directory);
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        packageManager: "pnpm@11.0.0",
        dependencies: {
          next: "16.3.4",
          ai: "6.0.0",
          "@openrouter/ai-sdk-provider": "2.1.1",
          "drizzle-orm": "0.45.1",
          "@neondatabase/serverless": "1.1.0",
        },
      }),
    );
    await writeFile(path.join(directory, "tsconfig.json"), "{}");
    const io = captureIo();
    const exitCode = await run(
      ["node", "promptmarket", "doctor", directory, "--offline"],
      io,
    );
    const agentIo = captureIo();
    const agentExit = await run(
      [
        "node",
        "promptmarket",
        "context",
        "add RAG",
        "--project",
        directory,
        "--format",
        "agent",
        "--offline",
        "--recipes",
        recipesDir,
      ],
      agentIo,
    );

    expect(exitCode).toBe(0);
    expect(io.out()).toContain("PromptMarket Doctor");
    expect(io.out()).toContain("Next.js 16");
    expect(io.out()).toContain("Vercel AI SDK 6");
    expect(io.out()).toContain("! AI SDK 6 → guide verified with AI SDK 7");
    expect(io.out()).toContain("✓ Drizzle 0.45");
    expect(io.out()).not.toContain("missing");
    expect(agentExit).toBe(0);
    expect(agentIo.out()).toContain("# PromptMarket Implementation Context");
    expect(agentIo.out()).toContain("## Compatibility");
    expect(agentIo.out()).toContain("## Recommended guide");
  });

  test("info without a recipe reports the content source", async function printsContentInfo() {
    const io = captureIo();
    const exitCode = await run(
      ["node", "promptmarket", "info", "--offline"],
      io,
    );

    expect(exitCode).toBe(0);
    expect(io.out()).toContain("PromptMarket CLI       0.9.0");
    expect(io.out()).toContain("Content source         offline");
    expect(io.out()).toContain("Offline snapshot       included");
  });

  test("uses hosted content, then cache, then the bundled snapshot", async function hostedContentFallback() {
    const catalog = loadContentCatalog();
    const meta = contentMeta(catalog, resolveContentDir());
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), "promptmarket-cache-"));
    tempDirs.push(cacheDir);
    let requests = 0;
    const server = createServer(function handle(request, response) {
      requests += 1;
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const match = request.headers["if-none-match"];
      const ifNoneMatch = Array.isArray(match) ? (match[0] ?? "") : (match ?? "");
      const result = handleContentRequest(
        catalog,
        new Request(`https://promptmarket.sh${url.pathname}${url.search}`, {
          headers: ifNoneMatch ? { "if-none-match": ifNoneMatch } : {},
        }),
        meta,
      );
      void result.arrayBuffer().then(function write(body) {
        response.writeHead(result.status, {
          etag: result.headers.get("etag") ?? "",
          "content-type": "application/json",
        });
        response.end(Buffer.from(body));
      });
    });
    await new Promise<void>(function listen(resolve) {
      server.listen(0, "127.0.0.1", function listening() {
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected a port");
    }
    const api = `http://127.0.0.1:${address.port}/api/content/v1`;
    const io = captureIo();
    const first = await run(
      ["node", "promptmarket", "learn", "rag", "--json", "--content-api", api],
      io,
      { contentCacheDir: cacheDir },
    );
    const cachedIo = captureIo();
    const second = await run(
      ["node", "promptmarket", "learn", "rag", "--json", "--content-api", api],
      cachedIo,
      { contentCacheDir: cacheDir },
    );
    const failedIo = captureIo();
    const failed = await run(
      [
        "node",
        "promptmarket",
        "learn",
        "rag",
        "--json",
        "--content-api",
        "http://127.0.0.1:1",
      ],
      failedIo,
      {
        contentCacheDir: path.join(cacheDir, "empty"),
        contentFetch: function failFetch() {
          return Promise.reject(new Error("offline"));
        },
      },
    );

    expect(first).toBe(0);
    expect(JSON.parse(io.out()).topic.slug).toBe("rag");
    expect(second).toBe(0);
    expect(requests).toBe(1);
    expect(failed).toBe(0);
    expect(JSON.parse(failedIo.out()).topic.slug).toBe("rag");

    const staleIo = captureIo();
    const stale = await run(
      ["node", "promptmarket", "learn", "rag", "--json", "--content-api", api],
      staleIo,
      {
        contentCacheDir: cacheDir,
        contentNow: function later() {
          return Date.now() + 16 * 60 * 1000;
        },
      },
    );
    expect(stale).toBe(0);
    expect(requests).toBe(2);
    server.close();

    const refreshIo = captureIo();
    const refreshed = await run(
      [
        "node",
        "promptmarket",
        "search",
        "rag",
        "--json",
        "--offline",
        "--refresh",
        "--recipes",
        recipesDir,
      ],
      refreshIo,
    );
    expect(refreshed).toBe(0);
    expect(JSON.parse(refreshIo.out()).ok).toBe(true);
    await mkdir(cacheDir, { recursive: true });
  });

  test("setup cursor merges mcp.json and writes the rule", async function setupsCursor() {
    const root = await mkdtemp(path.join(os.tmpdir(), "promptmarket-cursor-"));
    tempDirs.push(root);
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { next: "^16.0.0", ai: "^7.0.0" } }),
    );
    await mkdir(path.join(root, ".cursor"), { recursive: true });
    const mcpPath = path.join(root, ".cursor", "mcp.json");
    await writeFile(
      mcpPath,
      `${JSON.stringify({ mcpServers: { other: { url: "https://example.com/mcp" } } }, null, 2)}\n`,
    );

    const preview = captureIo();
    const previewCode = await run(
      ["node", "promptmarket", "setup", "cursor", "--dir", root],
      preview,
      { cursorAgent: false },
    );
    expect(previewCode).toBe(0);
    expect(preview.out()).toContain("Dry run");
    expect(await readFile(mcpPath, "utf8")).not.toContain("promptmarket");

    const writeIo = captureIo();
    const writeCode = await run(
      ["node", "promptmarket", "setup", "cursor", "--write", "--dir", root],
      writeIo,
    );
    expect(writeCode).toBe(0);
    expect(writeIo.out()).toContain("Applied.");
    const mcp = JSON.parse(await readFile(mcpPath, "utf8")) as {
      mcpServers: Record<string, { url: string }>;
    };
    expect(mcp.mcpServers.other?.url).toBe("https://example.com/mcp");
    expect(mcp.mcpServers.promptmarket?.url).toBe("https://promptmarket.sh/mcp");
    const rule = await readFile(
      path.join(root, ".cursor", "rules", "promptmarket.mdc"),
      "utf8",
    );
    expect(rule).toContain("alwaysApply: false");
    expect(rule).toContain("build_context");
    expect(rule).toContain("build_plan");

    const again = captureIo();
    const againCode = await run(
      ["node", "promptmarket", "setup", "cursor", "--write", "--dir", root],
      again,
    );
    expect(againCode).toBe(0);
    expect(again.out()).toContain("Already installed.");

    const check = captureIo();
    const checkCode = await run(
      ["node", "promptmarket", "setup", "cursor", "--check", "--dir", root],
      check,
      { cursorAgent: true },
    );
    expect(checkCode).toBe(0);
    expect(check.out()).toContain("✓ .cursor/mcp.json contains PromptMarket");
    expect(check.out()).toContain("✓ Next.js 16");
    expect(check.out()).toContain("✓ AI SDK 7");
    expect(check.out()).toContain("agent mcp list-tools promptmarket");

    const broken = `${mcpPath}.broken`;
    await writeFile(mcpPath, "{");
    const bad = captureIo();
    const badCode = await run(
      ["node", "promptmarket", "setup", "cursor", "--write", "--dir", root],
      bad,
    );
    expect(badCode).toBe(1);
    expect(bad.err()).toContain("Could not parse");
    expect(await readFile(mcpPath, "utf8")).toBe("{");
    await rm(broken, { force: true });

    await writeFile(
      mcpPath,
      `${JSON.stringify({
        mcpServers: {
          other: { url: "https://example.com/mcp" },
          promptmarket: { url: "https://promptmarket.sh/mcp" },
        },
      })}\n`,
    );
    const removeIo = captureIo();
    const removeCode = await run(
      ["node", "promptmarket", "setup", "cursor", "--remove", "--dir", root],
      removeIo,
    );
    expect(removeCode).toBe(0);
    const removed = JSON.parse(await readFile(mcpPath, "utf8")) as {
      mcpServers: Record<string, { url: string }>;
    };
    expect(removed.mcpServers.promptmarket).toBeUndefined();
    expect(removed.mcpServers.other?.url).toBe("https://example.com/mcp");
    await expect(
      stat(path.join(root, ".cursor", "rules", "promptmarket.mdc")),
    ).rejects.toThrow();
  });

  test("setup cursor hands Context7 to its official installer", async function setupsContext7() {
    const root = await mkdtemp(path.join(os.tmpdir(), "promptmarket-context7-"));
    tempDirs.push(root);
    await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: {} }));
    const calls: string[] = [];

    const dry = captureIo();
    const dryCode = await run(
      ["node", "promptmarket", "setup", "cursor", "--with-context7", "--dir", root],
      dry,
      {
        context7Handoff: async function handoff(directory) {
          calls.push(directory);
          return 0;
        },
      },
    );
    expect(dryCode).toBe(0);
    expect(dry.out()).toContain("npx --yes ctx7 setup --cursor --project");
    expect(calls).toEqual([]);
    expect(dry.out()).not.toContain("CONTEXT7_API_KEY");

    const write = captureIo();
    const writeCode = await run(
      [
        "node",
        "promptmarket",
        "setup",
        "cursor",
        "--write",
        "--with-context7",
        "--dir",
        root,
      ],
      write,
      {
        context7Handoff: async function handoff(directory) {
          calls.push(directory);
          return 0;
        },
      },
    );
    expect(writeCode).toBe(0);
    expect(calls).toEqual([root]);
    const mcp = await readFile(path.join(root, ".cursor", "mcp.json"), "utf8");
    expect(mcp).toContain("promptmarket");
    expect(mcp).not.toContain("context7");
    expect(mcp).not.toContain("CONTEXT7_API_KEY");
    const rule = await readFile(
      path.join(root, ".cursor", "rules", "promptmarket.mdc"),
      "utf8",
    );
    expect(rule).toContain("documentationTargets");
    expect(rule).toContain("evalTargets");
    expect(rule).toContain("debugTargets");

    await writeFile(
      path.join(root, ".cursor", "mcp.json"),
      `${JSON.stringify({
        mcpServers: {
          promptmarket: { url: "https://promptmarket.sh/mcp" },
          context7: {
            url: "https://mcp.context7.com/mcp",
            headers: { CONTEXT7_API_KEY: "secret" },
          },
        },
      })}\n`,
    );
    const again = captureIo();
    const againCode = await run(
      [
        "node",
        "promptmarket",
        "setup",
        "cursor",
        "--write",
        "--with-context7",
        "--dir",
        root,
      ],
      again,
      {
        context7Handoff: async function handoff(directory) {
          calls.push(directory);
          return 0;
        },
      },
    );
    expect(againCode).toBe(0);
    expect(again.out()).toContain("already configured");
    expect(calls).toEqual([root]);
    expect(again.out()).not.toContain("secret");
  });

  test("research stays optional until a documentation provider runs", async function researches() {
    const previous = process.env.CONTEXT7_API_KEY;
    delete process.env.CONTEXT7_API_KEY;
    const missing = captureIo();
    const missingCode = await run(
      ["node", "promptmarket", "research", "add RAG over internal documentation", "--json", "--offline"],
      missing,
    );
    expect(missingCode).toBe(1);
    expect(missing.out()).toContain("CONTEXT7_API_KEY");
    expect(missing.out()).not.toContain("OPENROUTER_API_KEY");

    const io = captureIo();
    const code = await run(
      ["node", "promptmarket", "research", "add RAG over internal documentation", "--json", "--offline"],
      io,
      {
        documentationProvider: {
          async resolveLibrary(input) {
            return { libraryId: "/vercel/ai", name: input.library };
          },
          async queryDocumentation(input) {
            return `docs for ${input.libraryId}`;
          },
          async search() {
            return { libraryId: "/vercel/ai", documentation: "docs for /vercel/ai" };
          },
        },
      },
    );
    expect(code).toBe(0);
    const body = JSON.parse(io.out()) as {
      kind: string;
      plan: { documentationTargets: Array<{ package: string }> };
      evidence: Array<{ libraryId?: string; documentation: string }>;
    };
    expect(body.kind).toBe("verified_plan");
    expect(body.plan.documentationTargets.map(function packageOf(target) {
      return target.package;
    })).toContain("ai");
    expect(body.evidence[0]?.libraryId).toBe("/vercel/ai");
    expect(body.evidence[0]?.documentation).toBe("docs for /vercel/ai");
    if (previous === undefined) {
      delete process.env.CONTEXT7_API_KEY;
    } else {
      process.env.CONTEXT7_API_KEY = previous;
    }
  });

  test("verify init writes a Promptfoo suite and run delegates to promptfoo", async function verifies() {
    const root = await mkdtemp(path.join(os.tmpdir(), "promptmarket-verify-"));
    const io = captureIo();
    const code = await run(
      ["node", "promptmarket", "verify", "init", "add RAG over internal documentation", "--json", "--offline", "--project", root],
      io,
    );
    expect(code).toBe(0);
    const body = JSON.parse(io.out()) as { guide: string; files: string[] };
    expect(body.guide).toBe("rag-knowledge-base");
    const config = await readFile(
      path.join(root, ".promptmarket", "evals", "rag-knowledge-base", "promptfooconfig.yaml"),
      "utf8",
    );
    expect(config).toContain("context-faithfulness");
    expect(config).toContain("file://provider.ts");
    const calls: string[][] = [];
    const runIo = captureIo();
    const runCode = await run(
      ["node", "promptmarket", "verify", "run", root],
      runIo,
      {
        command: async function command(_file, args, cwd) {
          calls.push([cwd, ...args]);
          return 0;
        },
      },
    );
    expect(runCode).toBe(0);
    expect(calls[0]?.join(" ")).toContain("promptfoo@latest eval");
    expect(calls[0]?.[0]).toContain("rag-knowledge-base");
    await rm(root, { recursive: true, force: true });
  });

  test("verify ci writes a Promptfoo GitHub workflow once", async function verifiesCi() {
    const root = await mkdtemp(path.join(os.tmpdir(), "promptmarket-ci-"));
    tempDirs.push(root);
    const io = captureIo();
    const code = await run(
      ["node", "promptmarket", "verify", "ci", "--github", "--json", "--project", root],
      io,
    );
    expect(code).toBe(0);
    const body = JSON.parse(io.out()) as { file: string; node: string; secrets: string[] };
    expect(body.file).toBe(".github/workflows/promptmarket-evals.yml");
    expect(body.node).toBe("24");
    expect(body.secrets).toContain("OPENAI_API_KEY");
    const workflow = await readFile(
      path.join(root, ".github", "workflows", "promptmarket-evals.yml"),
      "utf8",
    );
    expect(workflow).toContain("promptfoo/promptfoo-action@v1");
    expect(workflow).toContain('node-version: "24"');
    expect(workflow).toContain("working-directory: .promptmarket/evals/");
    expect(workflow).toContain("force-run: true");
    expect(workflow).toContain("@promptmarket/cli feature check --all");
    expect(workflow).toContain("GITHUB_STEP_SUMMARY");
    expect(workflow).toContain("@promptmarket/cli impacted --base");
    expect(workflow).not.toContain("paths:");
    const again = captureIo();
    const againCode = await run(
      ["node", "promptmarket", "verify", "ci", "--github", "--project", root],
      again,
    );
    expect(againCode).toBe(1);
    expect(again.err()).toContain("already exists");
  });

  test("observe names Langfuse and setup does not write files", async function observes() {
    const root = await mkdtemp(path.join(os.tmpdir(), "promptmarket-observe-"));
    tempDirs.push(root);
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          next: "16.0.0",
          ai: "7.0.0",
          "@openrouter/ai-sdk-provider": "2.0.0",
          "@opentelemetry/sdk-node": "0.200.0",
        },
      }),
    );
    await writeFile(path.join(root, "instrumentation.ts"), "export {}\n");
    const io = captureIo();
    const code = await run(
      ["node", "promptmarket", "observe", "add RAG over internal documentation", "--json", "--offline", "--project", root],
      io,
    );
    expect(code).toBe(0);
    const body = JSON.parse(io.out()) as {
      observabilityTargets: Array<{ provider: string }>;
    };
    expect(body.observabilityTargets[0]?.provider).toBe("langfuse");

    const setup = captureIo();
    const setupCode = await run(
      ["node", "promptmarket", "observe", "setup", "langfuse", "--json", "--offline", "--project", root],
      setup,
    );
    expect(setupCode).toBe(0);
    const setupBody = JSON.parse(setup.out()) as {
      wrote: boolean;
      text: string;
      telemetry: { files: string[] };
    };
    expect(setupBody.wrote).toBe(false);
    expect(setupBody.text).toContain("LANGFUSE_SECRET_KEY");
    expect(setupBody.text).toContain("@langfuse/vercel-ai-sdk");
    expect(setupBody.text).toContain("Existing telemetry configuration detected.");
    expect(setupBody.text).not.toContain("sk-lf-");
    expect(setupBody.telemetry.files).toContain("instrumentation.ts");
    await expect(stat(path.join(root, ".env.local"))).rejects.toThrow();

    const refused = captureIo();
    const refusedCode = await run(
      ["node", "promptmarket", "observe", "setup", "langfuse", "--write", "--offline", "--project", root],
      refused,
    );
    expect(refusedCode).toBe(1);
    expect(refused.err()).toContain("does not edit application code");
  });

  test("feature init writes a contract and check treats drift as a warning", async function features() {
    const root = await mkdtemp(path.join(os.tmpdir(), "promptmarket-feature-"));
    tempDirs.push(root);
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          next: "16.2.0",
          ai: "7.1.0",
          "drizzle-orm": "0.45.1",
        },
      }),
    );
    const io = captureIo();
    const code = await run(
      [
        "node",
        "promptmarket",
        "feature",
        "init",
        "add RAG over internal documentation",
        "--project",
        root,
        "--write",
        "--offline",
        "--json",
      ],
      io,
    );
    expect(code).toBe(0);
    const body = JSON.parse(io.out()) as {
      contract: { id: string; observability?: { provider: string } };
    };
    expect(body.contract.id).toBe("rag-internal-docs");
    const suite = await readFile(
      path.join(root, ".promptmarket", "evals", "rag-internal-docs", "promptfooconfig.yaml"),
      "utf8",
    );
    expect(suite).toContain("id: langfuse");
    expect(suite).toContain("LANGFUSE_PUBLIC_KEY");

    const status = captureIo();
    const statusCode = await run(
      ["node", "promptmarket", "feature", "status", "--project", root, "--offline"],
      status,
    );
    expect(statusCode).toBe(0);
    expect(status.out()).toContain("rag-internal-docs");
    expect(status.out()).toContain("catalog entry available");

    const check = captureIo();
    const checkCode = await run(
      ["node", "promptmarket", "feature", "check", "--all", "--project", root, "--offline", "--json"],
      check,
    );
    const checkBody = JSON.parse(check.out()) as { ok: boolean };
    expect(checkCode).toBe(0);
    expect(checkBody.ok).toBe(true);
  });

  test("impacted, review, and verify changed follow implementation paths", async function changeAware() {
    const root = await mkdtemp(path.join(os.tmpdir(), "promptmarket-impact-"));
    tempDirs.push(root);
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { next: "16.2.0", ai: "7.1.0" } }),
    );
    const init = captureIo();
    const initCode = await run(
      [
        "node",
        "promptmarket",
        "feature",
        "init",
        "add RAG over internal documentation",
        "--id",
        "internal-docs-rag",
        "--path",
        "app/api/chat/**",
        "--path",
        "lib/rag/**",
        "--project",
        root,
        "--write",
        "--offline",
        "--json",
      ],
      init,
    );
    expect(initCode).toBe(0);
    const contract = await readFile(
      path.join(root, ".promptmarket", "features", "internal-docs-rag.yaml"),
      "utf8",
    );
    expect(contract).toContain("app/api/chat/**");
    await writeFile(
      path.join(root, ".promptmarket", "features", "ai-project-manager.yaml"),
      [
        "schemaVersion: 1",
        "id: ai-project-manager",
        "goal: manage projects",
        "catalog:",
        "  version: test",
        "implementation:",
        "  paths:",
        "    - convex/**",
        "",
      ].join("\n"),
    );
    const git = async function git(args: string[]) {
      if (args.includes("origin/main...HEAD")) {
        return "app/api/chat/route.ts\nlib/rag/retrieval.ts\n";
      }
      return "";
    };
    const impact = captureIo();
    const impactCode = await run(
      ["node", "promptmarket", "impacted", "--base", "origin/main", "--project", root, "--offline"],
      impact,
      { git },
    );
    expect(impactCode).toBe(0);
    expect(impact.out()).toContain("internal-docs-rag");
    expect(impact.out()).toContain("Impacted");
    expect(impact.out()).toContain("✓ lib/rag/retrieval.ts");
    expect(impact.out()).toContain("Not impacted");
    expect(impact.out()).toContain("ai-project-manager");
    expect(impact.out()).toContain("Vercel AI SDK");

    const review = captureIo();
    const reviewCode = await run(
      ["node", "promptmarket", "feature", "review", "--base", "origin/main", "--project", root, "--offline"],
      review,
      { git },
    );
    expect(reviewCode).toBe(0);
    expect(review.out()).toContain("retrieval implementation changed");
    expect(review.out()).toContain("AI SDK route changed");
    expect(review.out()).not.toContain("ai-project-manager");

    const calls: string[] = [];
    const changed = captureIo();
    const changedCode = await run(
      ["node", "promptmarket", "verify", "changed", "--base", "origin/main", "--project", root],
      changed,
      {
        git,
        command: async function command(_file, _args, cwd) {
          calls.push(cwd);
          return 0;
        },
      },
    );
    expect(changedCode).toBe(0);
    expect(calls).toEqual([path.join(root, ".promptmarket", "evals", "internal-docs-rag")]);

    const adopted = captureIo();
    const adoptedCode = await run(
      [
        "node",
        "promptmarket",
        "feature",
        "adopt",
        "--id",
        "support-agent",
        "--goal",
        "support assistant with database tools",
        "--path",
        "app/api/support/**",
        "--project",
        root,
        "--write",
        "--offline",
        "--json",
      ],
      adopted,
    );
    expect(adoptedCode).toBe(0);
    const adoptedBody = JSON.parse(adopted.out()) as { touchedImplementation: boolean };
    expect(adoptedBody.touchedImplementation).toBe(false);
    await expect(stat(path.join(root, "app", "api", "support"))).rejects.toThrow();
  });
});
