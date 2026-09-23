---
title: "Evals"
module: reliability
order: 14
summary: "An eval is the AI equivalent of a unit or regression test."
definition: "An eval is a saved set of inputs, a way to score the outputs, and the discipline to run that score before you ship a change."
mentalModel: "Ship, watch what breaks, save the example, score it, change the system, run the score again."
why: "Prompts and models move. Without a score you can re-run, you cannot tell improvement from a different kind of mistake."
whenToUse:
  - "More than one person will change the prompt or the model."
  - "A failure in production was expensive enough that you do not want it back."
whenNotToUse:
  - "You have no real or realistic inputs yet. Collect a few before you invent a metric."
  - "You want a leaderboard number with no tie to your users' tasks."
diagram: eval
relatedPrompts:
  - prompt-evaluator
  - response-quality-grader
  - support-ticket-triage
relatedTopics:
  - rag
  - ai-engineering-is-experimental
  - optimization-ladder
---

## Example

Five saved tickets, each with the label a support lead assigned. Your classifier runs on all five. The score is how many labels match. You change the prompt so the refund ticket stops landing in `bug`. You run the five again. Four still match, including the ones that used to be right.

That is a regression test. It is allowed to be small. It is not allowed to be replaced by a vibe.

The loop is:

1. Ship the simplest version.
2. Observe failures from users or from your own review.
3. Save a representative input, with the output you wanted.
4. Score the set.
5. Change the prompt, the context, the tools, or the model.
6. Run the score again.
7. Ship when the score holds.

## Implementation notes

Prefer checks that do not need a model: parsed JSON, exact label, required citation id, a number copied from the source. Use an LLM as a judge only for judgments a program cannot make, such as whether a reply contradicted a policy. A judge is one technique. It needs its own examples, and it can be wrong in the same direction as the system it grades.

Build the dataset from real usage. A corrected draft, a retrieved document that should have been found, and a tool call that should have been refused are better items than synthetic happy paths.

When you test a new model, run the same cases. A model that is "smarter" in a demo can drop your format or your refusal rule.

Do not claim a public benchmark for a prompt someone copied. An eval is yours when the cases are yours.

## Common mistakes

- Scoring with the same prompt you are trying to improve, and trusting the circular grade.
- A hundred vague criteria and no saved inputs.
- Changing the cases every time the score looks bad, so nothing is a regression anymore.
