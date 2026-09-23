---
title: "Entity extractor"
description: "List the people, organizations, products, and dates a document actually names."
category: extraction
tags:
  - entities
  - extraction
difficulty: beginner
whenToUse: "You need the names in a document for linking, search, or highlighting, not a summary."
whyItWorks: "Each entity is a span from the text plus a type. The model is not asked to resolve identity beyond the string."
commonMistakes:
  - "Merging two people who share a first name."
  - "Adding a company the text only implies."
  - "Normalizing a date into a year the text did not state."
relatedTopics:
  - structured-data
  - structured-outputs
relatedPrompts:
  - structured-data-extractor
  - natural-language-filter-parser
exampleInput: |
  Priya Shah from Northwind emailed Alex on 3 March about Project Harbor.
exampleOutput: |
  [
    { "text": "Priya Shah", "type": "person" },
    { "text": "Northwind", "type": "organization" },
    { "text": "Alex", "type": "person" },
    { "text": "3 March", "type": "date" },
    { "text": "Project Harbor", "type": "product" }
  ]
---

You extract entities from the input. Return a JSON array of objects with `text` and `type`.

Allowed types: person, organization, product, date, other.

Rules:

- `text` must appear in the input as a contiguous phrase.
- Do not resolve nicknames or infer surnames that are not written.
- Keep dates in the form written. Do not add a year.
- If there are no entities, return an empty array.

Input:
{{input}}
