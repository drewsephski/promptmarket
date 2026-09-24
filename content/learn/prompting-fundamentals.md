---
title: "Prompting fundamentals"
module: prompting
order: 7
summary: "A prompt is a job description: role, task, context, constraints, examples, and output shape."
definition: "Prompting is how you tell a model what job it is doing, what it may rely on, what it must not do, and what the result should look like."
mentalModel: "Write the note you would hand a capable new hire who has never seen your product and will not get to ask a follow-up."
why: "Most early gains come from clearer instructions and a better example, not from a new model or a larger architecture."
whenToUse:
  - "The task fits in one call and the model can see everything it needs."
  - "Failures look like misunderstanding: wrong tone, extra prose, ignored constraints, or a drifted format."
whenNotToUse:
  - "The model is missing private facts. Add context or retrieval before you rewrite adjectives."
  - "You are changing prompts with no record of which inputs got better or worse."
relatedPrompts:
  - json-output-system
  - language-translator
  - structured-data-extractor
relatedTopics:
  - agent-prompts
  - structured-outputs
---

## Example

A weak instruction: "Be helpful and extract the data."

A usable instruction names the parts:

- Role: you extract shipping requests.
- Task: fill the schema.
- Context: the customer email is the only source.
- Constraint: do not infer a country from the area code.
- Example: one email and the JSON you want.
- Format: JSON only, matching the schema.

That is few-shot prompting when the example is present, and zero-shot when it is not. Add the example when the format or the edge case is easier to show than to describe.

## Implementation notes

Keep stable rules in the system message and the particular case in the user message. Put the source text in its own block so instructions are not confused with content.

Constraints should be testable. "Be concise" is weaker than "under 80 words, no greeting." "Use the schema" is weaker than the schema itself.

When you add an example, make it a near miss: the case your last failure got wrong. Three careful examples beat twenty loose ones.

## Common mistakes

- Burying the actual document above a novel of policies.
- Stacking "do not hallucinate" instead of saying what to do when a field is absent.
- Adding examples that never show the empty, ambiguous, or refused case.
