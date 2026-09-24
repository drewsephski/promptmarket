---
title: "How to write AI agent prompts"
module: prompting
order: 17
summary: "Write an AI agent prompt with a clear objective, tool boundaries, examples, stopping conditions, and checks you can evaluate."
definition: "An AI agent prompt is a set of instructions that tells a model what outcome to pursue, what context and tools it can use, and when to stop or ask for help."
mentalModel: "Write a work order with acceptance criteria. The model proposes the next step; your application decides which actions are allowed and records what happened."
why: "A multi-step task needs more than a role description. Explicit evidence and stopping rules make failures easier to diagnose and compare across prompt revisions."
whenToUse:
  - "The task needs tool results before the model can decide what to do next."
  - "You need repeatable instructions for completion, uncertainty, and failed actions."
whenNotToUse:
  - "A single extraction, classification, or answer is sufficient; use a focused prompt instead."
  - "You need to enforce access control or spending limits; those belong in application code."
relatedPrompts:
  - agent-system-prompt
  - safe-tool-calling-system
  - rag-grounded-answer
relatedTopics:
  - agents
  - prompting-fundamentals
  - tool-calling
  - agentic-loops
  - evals
---

## Example

Start with the [AI agent system prompt template](/prompts/agent-system-prompt), then replace the objective, context, tools, and success criteria with the actual task. For a support agent, a useful work order looks like this:

```text
Objective: Answer whether a deleted project can be recovered.
Context: The user belongs to the workspace selected by the application.
Tools: search_docs(query) retrieves product policy passages. It is read-only.
Success: Return an answer supported by the retrieved policy, citing its source.
Missing evidence: Say the policy could not be verified and ask for the missing source.
Stop: After a supported answer, or after a search returns no relevant policy.
Output: Answer, source, and any unresolved question.
```

Suppose the tool returns: "A workspace admin can restore a deleted project from the trash within 14 days." The expected answer is: "A workspace admin can restore it within 14 days, while it remains in the trash," with the source identifier attached. The agent has answered a question; it has not restored the project and must not claim that it has.

If the search finds no policy, the correct outcome is a clear gap in evidence. Inventing a recovery window would fail the acceptance criteria even if the response sounds helpful. These are illustrative examples, not measured model results.

## Implementation notes

### Include six parts in the prompt

1. Objective: describe the observable outcome, such as a cited answer or a reviewed change.
2. Context: provide the facts the model cannot infer and identify which sources are authoritative.
3. Tools: name the capabilities the runtime actually exposes and explain their inputs and limits.
4. Boundaries: state which actions require confirmation and what to do with missing information.
5. Completion: define evidence of success and the conditions for stopping or escalating.
6. Output: specify the final artifact, supporting evidence, and unfinished work.

Keep stable instructions in the system or developer message supported by your provider. Put the specific task in the user message. Keep retrieved documents and tool results in clearly separated data blocks. Delimiters help describe the boundary, but they do not prevent prompt injection by themselves.

### Match the template to the task

Use the [tool-calling prompt](/prompts/safe-tool-calling-system) when the model requests a known operation. Use the [RAG prompt](/prompts/rag-grounded-answer) when the job is to answer from retrieved passages. Use [coding agent skills](/recipes) for a reusable procedure such as reviewing a pull request. The [prompt library](/prompts) includes examples of extraction, classification, support, and evaluation as well.

For a coding agent, success criteria might be a targeted change, the relevant tests, and a report of any checks that could not run. Name the repository conventions and allowed files. Do not treat "implement the feature" as permission to deploy, delete data, or send messages.

### Test the prompt before expanding the agent

Create a small fixed set of cases before editing the instructions. Include a normal task, missing context, a denied action, a tool error, a repeated tool failure, and a retrieved document that tries to issue new instructions. Record the prompt revision, model, tool definitions, actual output, and pass or fail criteria for every run.

For the support example, check that a policy-backed answer cites the correct passage, a missing policy produces no invented deadline, and a failed search does not cause an endless retry. Validate citations and tool arguments in code where possible. Use the [evals lesson](/learn/evals) to compare changes against the same cases rather than judging a single fluent response.

Enforce tool authorization, argument schemas, tenant scope, maximum steps, timeouts, and cost budgets in the application. A stronger prompt does not replace these controls. Keep a trace of tool requests and results so you can tell a prompting failure from a retrieval or runtime failure.

## Common mistakes

- Starting with "you are an expert agent" and never defining the artifact or acceptance criteria.
- Copying tool names from a template that do not exist in the application's tool registry.
- Combining trusted instructions with untrusted retrieved text without identifying their different roles.
- Repeating "be accurate" instead of defining what evidence is required and what happens when it is absent.
- Allowing unlimited retries because the prompt says to keep trying until it succeeds.
- Reporting planned actions as completed actions, or treating a model's confidence as authorization.
- Claiming a prompt is tested or production-ready without publishing the cases, model configuration, and observed results.
