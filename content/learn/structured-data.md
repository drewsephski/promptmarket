---
title: "Structured data"
module: uses
order: 2
summary: "Turn unstructured text into fields your program can use."
definition: "Structured data extraction asks a model to read messy text and return values that match a known shape."
mentalModel: "You are handing the model a form and a pile of notes. It fills the form. It does not invent new boxes."
why: "Applications need fields, not paragraphs. An order id, a date, or a list of entities can be validated. A paragraph cannot."
whenToUse:
  - "The input is email, chat, a PDF's text, or some other blob a person wrote."
  - "Downstream code needs specific fields, and missing data should be visible."
whenNotToUse:
  - "The text already arrives as JSON or rows."
  - "You need a judgment, such as a label, more than you need fields."
diagram: extract
relatedPrompts:
  - structured-data-extractor
  - entity-extractor
  - meeting-action-items
  - natural-language-filter-parser
relatedTopics:
  - what-llms-are-good-at
  - structured-outputs
---

## Example

Input: "Can you move Priya's demo to Thursday at 2, and tell Alex? It's about the annual plan."

A useful result is data, not a recap:

```json
{
  "attendees": ["Priya", "Alex"],
  "day": "Thursday",
  "time": "14:00",
  "topic": "annual plan",
  "missing": ["timezone", "date"]
}
```

The nulls and the missing list are the point. The model reports what the text did not say.

## Implementation notes

Give the model the schema in the prompt, including which fields may be null. Ask it to copy strings from the input when the exact wording matters, and to normalize only the fields you name, such as dates.

Validate the result with a parser. A schema failure is an ordinary error: retry once with the parser message, or send the item to a person. Do not `eval` the text.

Save inputs that produced a null you did not expect. Those become eval cases.

## Common mistakes

- Asking for "JSON" without listing the keys.
- Letting the model guess an email, a date, or an id that was not in the text.
- Trusting the first successful parse and never checking fields against the source.
