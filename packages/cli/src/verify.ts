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

export function langfuseTracing(): Record<string, unknown> {
  return {
    enabled: true,
    provider: {
      id: "langfuse",
      endpoint: "https://cloud.langfuse.com",
      auth: {
        username: "{{ env.LANGFUSE_PUBLIC_KEY }}",
        password: "{{ env.LANGFUSE_SECRET_KEY }}",
      },
    },
  };
}

export function promptfooConfig(
  target: EvalTarget,
  options: { tracing?: boolean } = {},
): string {
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
  if (options.tracing) {
    document.tracing = langfuseTracing();
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
  workflow_dispatch:

# One workflow always starts. Impact is calculated inside so a path filter
# cannot skip the job and leave a required check pending.
# Promptfoo owns evaluation, assertions, scoring, and the pull request comment.

jobs:
  impact:
    runs-on: ubuntu-latest
    outputs:
      suites: \${{ steps.resolve.outputs.suites }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Set up Node.js
        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
        with:
          node-version: "24"
      - id: resolve
        run: |
          if [ "\${{ github.event_name }}" = "pull_request" ]; then
            base="\${{ github.event.pull_request.base.sha }}"
          else
            base="origin/\${{ github.event.repository.default_branch }}"
            git fetch --no-tags origin "\${{ github.event.repository.default_branch }}"
          fi
          npx --yes @promptmarket/cli impacted --base "$base" --json --offline > "$RUNNER_TEMP/impact.json"
          node --input-type=module -e 'import { readFileSync } from "node:fs"; const impact = JSON.parse(readFileSync(process.argv[1], "utf8")); const suites = impact.features.filter((feature) => feature.status === "impacted" && feature.suite).map((feature) => feature.suite); process.stdout.write(JSON.stringify(suites));' "$RUNNER_TEMP/impact.json" > "$RUNNER_TEMP/suites.json"
          echo "suites=$(cat "$RUNNER_TEMP/suites.json")" >> "$GITHUB_OUTPUT"
          npx --yes @promptmarket/cli impacted --base "$base" --github-summary --offline >> "$GITHUB_STEP_SUMMARY"

  evaluate:
    needs: impact
    if: needs.impact.outputs.suites != '[]'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    strategy:
      fail-fast: false
      matrix:
        suite: \${{ fromJson(needs.impact.outputs.suites) }}
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

  report:
    needs: [impact, evaluate]
    if: always() && needs.impact.result == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
        with:
          node-version: "24"
      - name: PromptMarket feature check
        run: npx --yes @promptmarket/cli feature check --all --offline
      - name: PromptMarket summary
        if: always()
        run: npx --yes @promptmarket/cli feature status --github-summary --offline >> "$GITHUB_STEP_SUMMARY"
`;
}

export async function writeEvalSuite(
  root: string,
  target: EvalTarget,
  options: { directoryName?: string; tracing?: boolean } = {},
): Promise<string[]> {
  const directory = path.join(root, EVAL_ROOT, options.directoryName ?? target.guide);
  await mkdir(directory, { recursive: true });
  const files = [
    ["promptfooconfig.yaml", promptfooConfig(target, { tracing: options.tracing })],
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
