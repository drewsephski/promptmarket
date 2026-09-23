import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
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
      ["node", "promptmarket", "show", "structured-data-extractor", "--json"],
      io,
    );
    const shownPayload = JSON.parse(io.out()) as {
      ok: boolean;
      kind: string;
      prompt: { name: string; body: string; variables: string[] };
    };
    const learnIo = captureIo();
    const learned = await run(
      ["node", "promptmarket", "learn", "rag", "--json"],
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
      ["node", "promptmarket", "guides", "--json"],
      guidesIo,
    );
    const guides = JSON.parse(guidesIo.out()) as {
      ok: boolean;
      guides: Array<{ slug: string }>;
    };
    const guideIo = captureIo();
    const guideExit = await run(
      ["node", "promptmarket", "guide", "ai-product-brief-builder", "--json"],
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
    ).toContain("ai-product-brief-builder");
    expect(guideExit).toBe(0);
    expect(guide.guide.slug).toBe("ai-product-brief-builder");
    expect(guide.guide.url).toBe(
      "https://promptmarket.sh/guides/ai-product-brief-builder",
    );
    expect(guide.guide.sections.length).toBeGreaterThan(5);
  });
});
