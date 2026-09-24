# PromptMarket 0.9.0 release validation

Tested September 24, 2026 on macOS with Node.js 26.3.0. The CLI release is `@promptmarket/cli@0.9.0`; the hosted MCP server is independently deployed at `https://promptmarket.sh/mcp` and reports version `0.9.0`.

## Release

Published successfully as npm’s public `latest` release. The registry integrity matches the exact tested tarball. The tested tarball contains 45 files, is 298,134 bytes compressed, and includes the new agent setup commands and bundled agent-prompt content.

- SHA-1: `b179ed9bbea28ed383e1a149d72da4a868349d96`
- SHA-512 integrity: `sha512-+JBjNropIUb+SZBcujkQI9Gu28XaO/PcZKMoK+QijRS0n9JwzzQySOSGAnSQqu7fk8ITHyOomXSRTfP9Nw1IMQ==`
- npm: https://www.npmjs.com/package/@promptmarket/cli/v/0.9.0
- No Git commit, tag, push, or website deployment was performed.

## Verification

- 168 tests passed across schema (19), content (23), registry (46), MCP (16), CLI (53), and web (11).
- Workspace type checking, lint, production build, and `git diff --check` passed.
- Installed the tarball into a separate temporary consumer project; checked its executable and bundled content outside the repository. After publication, installed `@promptmarket/cli@0.9.0` from the public registry into a second clean consumer project and repeated all 37 checks plus all 36 retrieval cases successfully. `pnpm dlx @promptmarket/cli@latest --version` returned `0.9.0`.
- 37 CLI process checks passed: version, content information, online search, offline prompt/lesson/guide lookup, missing-item error, all five agent setup lifecycles, project detection, planning, feature creation/checking, and a real registry skill installation.
- For Codex, OpenCode, Cursor, Claude Code, and GitHub Copilot: preview, write, check, repeated write, and remove succeeded; unrelated fixture files remained intact. These tests validate generated configuration, not a running session inside each agent application.
- All 14 hosted MCP tools responded successfully over the actual Streamable HTTP protocol using the MCP SDK client. Missing prompts, missing recipes, and invalid argument types returned structured errors; subsequent calls succeeded.
- Local MCP stdio handshake, listing of 14 tools, and RAG workflow passed.
- A small concurrent hosted MCP check completed 20 workflow requests at concurrency five with zero errors (283 ms median, 598 ms p95; 2,194 ms total). This is a smoke test, not a capacity benchmark.

## Retrieval benchmark

The repository's 36 curated retrieval cases were sent through the installed CLI and the live MCP server. Each case specifies one or more expected guide, topic, or prompt results. There were 57 scored expectations in total. Both interfaces produced the same scores:

| Result type | Top 1 | Top 3 |
| --- | --- | --- |
| Guide | 19/19 (100%) | 19/19 (100%) |
| Topic | 19/21 (90.5%) | 21/21 (100%) |
| Prompt | 16/17 (94.1%) | 17/17 (100%) |
| Combined | 54/57 (94.7%) | 57/57 (100%) |

Latency, one sequential pass of 36 queries per interface. CLI numbers below are from the fresh public-registry install after publication; MCP numbers are from the live server:

| Interface | Median | p95 | Range |
| --- | --- | --- | --- |
| Hosted MCP `build_context` | 158 ms | 219 ms | 130–282 ms |
| Published CLI `context --json` | 585 ms | 925 ms | 494–936 ms |

MCP timing uses an established client connection. CLI timing includes starting a fresh Node process and registry access; content normally comes from the local cache. These are observed timings from one machine, not a load test or an SLA. The curated cases include exact catalog wording and are not a blind evaluation of arbitrary user requests.

## Findings

1. **Shared content was missing from Turbo's cache inputs.** A fresh run caught invalid content while an earlier cached run reported success. Added `content/**` and `recipes/**` to `globalDependencies` in `turbo.json`. Concurrent content edits finished, and the resulting catalog passed a fresh suite before packaging.
2. **Natural-language relevance needs broader coverage.** On the live MCP, “Extract invoice line items into validated JSON” selected `meeting-action-items`; “Add voice conversations to my app” selected the RAG guide and prompt; “Detect prompt injection in uploaded documents” selected `json-output-system` with a RAG guide. These are poor matches for the requests. A completely unrelated query, “quantum banana skateboard,” correctly returned no matching concept and empty targets.
3. **Hosted and bundled content differ.** The tarball includes `agent-system-prompt` and the `agent-prompts` lesson. The live MCP returned unknown-item errors for both. Publishing npm does not deploy the hosted catalog, and normal online CLI use prefers hosted/cached content over the bundled snapshot.
4. **`--offline` is limited to content loading.** Offline prompt lookup works, and content API failure falls back to bundled content. However, `context RAG --offline --registry http://127.0.0.1:1 --json` fails because context also queries the recipe registry. Full offline context therefore requires a usable local recipe registry.
5. **Workflow output is fairly large.** Successful exploratory `get_workflow` responses serialized to roughly 39–54 KB. The MCP response includes both structured and text representations, so serialized bytes do not directly equal model token consumption.

The verification checked catalog retrieval, tooling, configuration writes, error handling, and latency. It did not execute generated applications, billable model evaluations, Context7 research, or authenticated Langfuse workflows.

Raw benchmark results and temporary scripts are in `/tmp/promptmarket-release-0.9.0/` for this session. Post-publication CLI results and registry integrity proof are in its `published/` directory.
