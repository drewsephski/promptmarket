---
title: "AI engineering is experimental"
module: reliability
order: 13
summary: "The first version will be wrong in specific ways. Keep those examples and change the system against them."
definition: "AI engineering is experimental because model output is probabilistic: the same-looking change can fix one input and break another."
mentalModel: "You are tuning a process, not flipping a correctness switch. Every change is a trial, and the trial needs a record."
why: "If you only watch a demo, you will ship the demo. The failures that matter show up on real inputs, often the awkward ones nobody put in the prompt."
whenToUse:
  - "You are about to change a prompt, a model, a retrieval setting, or a tool list."
  - "Users are already producing inputs you did not imagine."
whenNotToUse:
  - "There is nothing to compare. Write the smallest baseline and collect a few real inputs first."
  - "The task is deterministic code. Test it as code."
relatedPrompts:
  - response-quality-grader
  - prompt-evaluator
relatedTopics:
  - evals
---

## Example

A classifier looks perfect on ten clean sentences, then labels "please stop billing me" as a bug report because the word "bug" never appeared and "billing" was not in the example set.

That message is not an anecdote. Save it. It becomes a case. The next prompt change has to get this case right and keep the older cases right.

User feedback, a thumbs-down, a corrected label, or a support agent rewriting the draft are all ways those cases arrive. Failure analysis is reading a handful of them until the miss has a name: missing label, ignored constraint, retrieval miss, or format break.

## Implementation notes

Change one thing at a time when you can: the instruction, or the examples, or the model. A bundle of changes that "feels better" cannot be debugged.

Keep a small set of inputs next to the prompt in version control. Run them when the prompt changes. That habit is the start of an eval, even before you build a harness.

Talk to the people who see the failures. Their correction is a label. Do not paraphrase it into a vaguer principle and throw away the original text.

## Common mistakes

- Declaring the prompt done because one hand-picked example looked good.
- Swapping models to escape a prompt bug, then losing the cases that would have shown the swap failed.
- Collecting feedback and never turning a single comment into a saved input.
