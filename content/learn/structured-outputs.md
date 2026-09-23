---
title: "Structured outputs"
module: patterns
order: 8
summary: "Require the model to produce data that matches a known structure."
definition: "Structured output means the model's reply is data your program can parse, with keys, types, and allowed values you decided ahead of time."
mentalModel: "You are not hoping the paragraph contains a JSON object. You are requiring the object, and treating anything else as a failed call."
why: "The rest of the system is code. Code can validate a shape. It cannot reliably scrape meaning out of prose."
whenToUse:
  - "Another function, database, or UI will consume the result."
  - "The allowed values are an enum, a schema, or a tool's arguments."
whenNotToUse:
  - "The user is the only reader and a normal explanation is the product."
  - "You have not decided the shape yet. Decide it before you prompt."
diagram: extract
relatedPrompts:
  - structured-data-extractor
  - intent-classifier
  - json-output-system
  - natural-language-filter-parser
  - entity-extractor
relatedTopics:
  - structured-data
  - classification
  - prompting-fundamentals
---

## Example

Instead of "reply with the category and a reason," require:

```json
{ "label": "billing", "evidence": "charged twice" }
```

`label` is one of five strings. `evidence` is a short quote. A parser rejects extra keys, missing keys, and labels outside the list. The call is then either usable or visibly failed.

## Implementation notes

Prefer the model's native structured-output or tool-argument mode when the provider has one. The prompt should still include the schema, because it tells the model what the fields mean, not only what they are called.

Validate again in your code. Provider-side structure checks types. It does not know that `evidence` must be a substring of the input, or that `label: other` should skip automation.

Keep the schema boring. Flat objects and short enums are easier to test than nested trees invented on the first afternoon.

## Common mistakes

- Parsing the first `{` to the last `}` and ignoring a preamble the model added.
- Using a structure so loose that almost any reply validates.
- Changing the schema in the prompt and forgetting the validator, or the reverse.
