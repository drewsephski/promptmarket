import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { FileRegistry, handleRegistryRequest } from "@promptmarket/registry";
import { createRegistry, run, type CliIo } from "../src/program.js";

const recipesDir = path.resolve(import.meta.dirname, "../../../recipes");
const fixture = path.join(recipesDir, "github-pr-review");

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
        version: "0.1.0",
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
    expect(payload.installed.version).toBe("0.1.0");
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
      handleRegistryRequest(registry, new Request(url, { method: request.method }))
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
});
