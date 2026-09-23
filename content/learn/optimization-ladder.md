---
title: "Optimization ladder"
module: optimization
order: 15
summary: "Use the simplest technique that solves the problem. Later rungs cost more."
definition: "The optimization ladder is an order for adding technique: start with a plain prompt, and move up only when the previous rung is not enough."
mentalModel: "A staircase where each step is more machinery. Climbing is not progress. Arriving at the lowest step that works is progress."
why: "Later techniques add cost, latency, and failure modes. Fine-tuning will not repair a task you have not defined, and an agent will not repair a missing eval."
whenToUse:
  - "You are choosing the next change after a baseline has real failures."
  - "Someone proposes a more complex system and you need a reason to wait."
whenNotToUse:
  - "You already know a hard constraint, such as a tool the product must call. Do not pretend the first rung forbids it."
  - "You are using the ladder as a roadmap you must finish."
diagram: ladder
relatedPrompts:
  - json-output-system
  - prompt-evaluator
  - rag-grounded-answer
relatedTopics:
  - evals
  - building-ai-products
---

## Example

A feature that turns bug reports into labels:

1. Zero-shot instruction and a label list.
2. Clearer rules and the context of what each label means.
3. Few-shot examples, including one near miss.
4. A model or setting change, checked on the same cases, not assumed.
5. A workflow, if extraction and labeling are tangled.
6. An eval from the mislabels you have now collected.
7. An agentic loop, only if the report cannot be labeled until something is looked up.
8. A router, if different report types deserve different prompts.
9. Fine-tuning or another expensive optimization, after the data and the score exist.

Stop at the first rung that meets the bar. Write down why you left the previous one.

## Implementation notes

Rungs 1 through 3 are prompt work. Rung 4 is a measured swap. Rungs 5 and 7 change the shape of the system. Rung 6 should start as soon as you have failures, not after the architecture is impressive. Rung 8 sends different inputs to different simpler systems. Rung 9 assumes you have more good examples than you have prompt tricks left.

If a rung does not move the eval, step back down. Complexity you cannot justify is a defect.

## Common mistakes

- Treating the bottom of the ladder as naive and the top as mature.
- Fine-tuning to avoid writing ten examples into the prompt.
- Adding a router or an agent before you can score the single-prompt version.
