export const AGENT_INSTRUCTIONS = `Before modifying AI-related code:

1. Read \`.promptmarket/features/*.yaml\`.
2. Compare the files you expect to edit with \`implementation.paths\`.
3. If an existing feature owns those paths, treat its contract as the baseline, call \`get_workflow\` with that feature, and preserve its verification requirements.
4. If no contract matches and the work creates a new AI capability, call \`get_workflow\`, then suggest \`promptmarket feature init\` with \`--path\` after implementation.
5. \`get_workflow\` returns the same decision as \`build_context\` and \`build_plan\`, plus \`documentationTargets\`, \`debugTargets\`, \`evalTargets\`, and \`observabilityTargets\`. It does not read the repository, and it does not call Context7, Promptfoo, or Langfuse.
6. Read \`documentationTargets\`. For each target, use Context7 when available, or read the official library documentation, for the target reason and detected version. Use current official documentation for library syntax.
7. Treat PromptMarket as the source of truth for architecture, the AI engineering pattern, implementation sequence, prompting strategy, and which checks matter.
8. If current documentation conflicts with a PromptMarket guide, follow the current documentation, adapt the guide, and mention the discrepancy.
9. Implement using the existing repository's conventions. Do not paste instrumentation from memory.
10. When behavior is wrong, read \`debugTargets\` and follow the diagnosis order. For \`ai-sdk-devtools\`, follow current AI SDK docs to register DevTools for the installed version, then run \`npx @ai-sdk/devtools@latest\`. DevTools stores prompts and tool data locally in plain text. Use it only in local development.
11. Before considering the work complete, keep the feature contract in \`.promptmarket/features/\`. Own the files you touched with \`implementation.paths\`. Run \`promptmarket verify changed --base origin/main\` so only the impacted Promptfoo suite runs. Promptfoo owns the evaluator.
12. Before merge, run \`promptmarket verify ci --github\` so the Promptfoo GitHub Action gates the pull request. The workflow computes impact inside the job and runs only the affected suites. Promptfoo posts the result and fails the job when the suite fails. \`promptmarket feature check --all\` fails only on objective contract problems.
13. When production tracing is in scope, read \`observabilityTargets\`. For Langfuse, query current Langfuse and AI SDK docs, inspect any existing OpenTelemetry setup, and integrate without replacing an existing tracer. \`promptmarket observe setup langfuse\` prints packages, environment names, and metadata. It does not edit application code. Curated Langfuse dataset items become regression cases with \`promptmarket verify sync langfuse\`.
14. Never assume external services or environment configuration exist merely because the guide requires them.

A PromptMarket plan is curated knowledge from when the guide was written. It becomes a verified plan only after those documentation targets are reconciled with live library docs. Do not describe the plan as live-verified before that step.
`;
