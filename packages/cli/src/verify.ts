import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvalKind, EvalTarget, GuideEvalCase } from "@promptmarket/content";
import { stringify } from "yaml";

export const EVAL_ROOT = ".promptmarket/evals";

export const EVAL_WORKFLOW = ".github/workflows/promptmarket-evals.yml";

export type CommandRunner = (
  file: string,
  args: string[],
  cwd: string,
) => Promise<number>;

export const PROMPTFOO_EVAL = [
  "--yes",
  "promptfoo@latest",
  "eval",
  "-c",
  "promptfooconfig.yaml",
] as const;

export const PROMPTFOO_VIEW = ["--yes", "promptfoo@latest", "view"] as const;

export function runInherited(
  file: string,
  args: string[],
  cwd: string,
): Promise<number> {
  return new Promise(function settle(resolve, reject) {
    const child = spawn(file, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", function exited(code) {
      resolve(code ?? 1);
    });
  });
}

function expectationText(value: string | string[]): string {
  return Array.isArray(value) ? value.join(" → ") : value;
}

function toolNames(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  const called = value.match(/^([A-Za-z_][\w]*) is called$/);
  return called?.[1] ? [called[1]] : [];
}

function caseAssertions(kind: EvalKind, item: GuideEvalCase): unknown[] {
  const text = expectationText(item.expectation);
  if (kind === "tool-calling") {
    const tools = toolNames(item.expectation);
    const asserts: unknown[] = tools.map(function used(tool) {
      return { type: "trajectory:tool-used", value: tool };
    });
    if (tools.length > 1) {
      asserts.unshift({
        type: "trajectory:tool-sequence",
        value: { steps: tools },
      });
    }
    asserts.push({ type: "llm-rubric", value: text });
    return asserts;
  }
  if (kind === "structured-output") {
    return [
      { type: "is-json" },
      { type: "llm-rubric", value: text },
    ];
  }
  return [{ type: "llm-rubric", value: text }];
}

function defaultAssertions(kind: EvalKind): unknown[] {
  if (kind === "rag") {
    return [
      { type: "answer-relevance", threshold: 0.7 },
      { type: "context-faithfulness", threshold: 0.8 },
      { type: "context-relevance" },
    ];
  }
  return [];
}

export function promptfooConfig(target: EvalTarget): string {
  const defaults = defaultAssertions(target.kind);
  const document: Record<string, unknown> = {
    description: `PromptMarket ${target.kind} checks for ${target.guide}. Promptfoo grades these assertions.`,
    prompts: ["{{input}}"],
    providers: [{ id: "file://provider.ts", label: "app" }],
    tests: "file://cases.yaml",
  };
  if (defaults.length > 0) {
    document.defaultTest = { assert: defaults };
  }
  return stringify(document);
}

export function promptfooCases(target: EvalTarget): string {
  const cases = target.cases.map(function item(entry) {
    return {
      description: entry.name,
      vars: { input: entry.input },
      assert: caseAssertions(target.kind, entry),
    };
  });
  return stringify(cases);
}

export function providerSource(target: EvalTarget): string {
  const ragNote =
    target.kind === "rag"
      ? "\n * For context-faithfulness, context-relevance, and context-recall, put retrieved passages in vars.context."
      : "";
  const traceNote =
    target.kind === "tool-calling"
      ? "\n * Return a trace so trajectory:tool-used and trajectory:tool-sequence can see the tool calls."
      : "";
  return `/**
 * Promptfoo calls callApi once per case.
 * Wire this to the app under test. PromptMarket does not grade the result.${ragNote}${traceNote}
 */
async function callApi(
  prompt: string,
  context: { vars: Record<string, string> },
): Promise<{ output: string }> {
  const input = context.vars.input ?? prompt;
  return {
    output: \`Not wired. Case input: \${input}\`,
  };
}

export default { callApi };
`;
}

export function githubEvalWorkflow(): string {
  return `name: PromptMarket evals

on:
  pull_request:
    paths:
      - ".promptmarket/evals/**"
      - ".github/workflows/promptmarket-evals.yml"
      - "app/**"
      - "src/**"
      - "packages/**"
  workflow_dispatch:

# Promptfoo owns evaluation, assertions, scoring, and the pull request comment.
# A failed assertion fails this job. Widen paths to the code provider.ts calls.

jobs:
  discover:
    runs-on: ubuntu-latest
    outputs:
      suites: \${{ steps.list.outputs.suites }}
    steps:
      - uses: actions/checkout@v4
      - id: list
        run: |
          if [ ! -d .promptmarket/evals ]; then
            echo 'suites=[]' >> "$GITHUB_OUTPUT"
            exit 0
          fi
          mapfile -t dirs < <(find .promptmarket/evals -mindepth 1 -maxdepth 1 -type d -printf '%P\\n' | sort)
          if [ \${#dirs[@]} -eq 0 ]; then
            echo 'suites=[]' >> "$GITHUB_OUTPUT"
            exit 0
          fi
          json=$(printf '%s\\n' "\${dirs[@]}" | jq -R . | jq -s -c .)
          echo "suites=$json" >> "$GITHUB_OUTPUT"

  evaluate:
    needs: discover
    if: needs.discover.outputs.suites != '[]'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    strategy:
      fail-fast: false
      matrix:
        suite: \${{ fromJson(needs.discover.outputs.suites) }}
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
        with:
          node-version: "24"
      - name: Cache Promptfoo
        uses: actions/cache@v4
        with:
          path: .promptfoo-cache
          key: \${{ runner.os }}-promptfoo-\${{ matrix.suite }}-\${{ hashFiles(format('.promptmarket/evals/{0}/**', matrix.suite)) }}
          restore-keys: |
            \${{ runner.os }}-promptfoo-\${{ matrix.suite }}-
      - name: Run Promptfoo
        uses: promptfoo/promptfoo-action@v1
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
          working-directory: .promptmarket/evals/\${{ matrix.suite }}
          config: promptfooconfig.yaml
          cache-path: \${{ github.workspace }}/.promptfoo-cache
          use-config-prompts: true
          force-run: true
          no-table: true
          no-progress-bar: true
        env:
          # Promptfoo graders such as llm-rubric use this unless the suite says otherwise.
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
          # Add the key provider.ts uses once it calls the app, for example OPENROUTER_API_KEY.
`;
}

export async function writeEvalSuite(
  root: string,
  target: EvalTarget,
): Promise<string[]> {
  const directory = path.join(root, EVAL_ROOT, target.guide);
  await mkdir(directory, { recursive: true });
  const files = [
    ["promptfooconfig.yaml", promptfooConfig(target)],
    ["cases.yaml", promptfooCases(target)],
    ["provider.ts", providerSource(target)],
  ] as const;
  for (const [name, contents] of files) {
    await writeFile(path.join(directory, name), contents, { flag: "wx" });
  }
  return files.map(function nameOf(file) {
    return file[0];
  });
}
