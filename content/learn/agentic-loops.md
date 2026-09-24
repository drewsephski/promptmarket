---
title: "Agentic loops"
module: patterns
order: 12
summary: "Let the model choose actions repeatedly until a stopping condition."
definition: "An agentic loop lets the model observe a result, request another tool, and continue until it stops or you stop it."
mentalModel: "A short research shift with a clock. The model may take another action only while the stop rule says the job is unfinished."
why: "Some tasks have an unknown number of steps: find the file, read it, notice a second file, then answer. A fixed workflow cannot name that path in advance."
whenToUse:
  - "You cannot list the steps because each result changes what is needed next."
  - "You have a hard stop: a step limit, a budget, or a confirmation before side effects."
whenNotToUse:
  - "The path is predictable. Use a workflow."
  - "A wrong action is expensive and you have no confirmation in the loop."
diagram: agent
relatedPrompts:
  - agent-system-prompt
  - safe-tool-calling-system
  - tool-selection-router
relatedTopics:
  - agent-prompts
  - agents
  - tool-calling
  - workflows
---

## Example

Goal: "Why did the signup test start failing?"

1. The model requests `search_repo` for the test name.
2. Your code returns the file path and the assertion.
3. The model requests `read_file` on the helper the assertion calls.
4. Your code returns the helper.
5. The model answers with the mismatch and stops.

The loop ends because the model returned a final answer, or because it hit the step limit. It does not end because the prose sounded finished while another tool call was pending.

## Implementation notes

Every iteration should be a tool call or a final answer, not a blend. Keep a transcript of calls and results. That transcript is the artifact you read when the agent wanders.

Cap steps and tool failures. Two identical failing calls in a row should stop the loop and surface the error.

Write side effects so they require a confirmation tool or sit outside the loop. Reading can be iterative. Sending email should not be.

## Common mistakes

- Using a loop because agents are in fashion, on a task with three known steps.
- No step limit, so a confused model keeps searching until the bill arrives.
- Letting the model declare success without checking that the original goal was answered.
