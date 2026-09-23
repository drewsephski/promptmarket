---
title: "Structured data extractor"
description: "Extract a JSON object from messy user text."
category: extraction
tags:
  - extraction
  - json
  - schema
  - messy-text
difficulty: beginner
whenToUse: "A person wrote the input, and your code needs fields that match a schema you already chose."
whyItWorks: "The schema is the contract. Nulls make missing facts visible instead of letting the model invent them."
commonMistakes:
  - "Listing no schema and asking for JSON in general."
  - "Forgetting to reject keys that are not in the schema."
  - "Skipping an eval once a few real messages parse successfully."
relatedTopics:
  - what-llms-are-good-at
  - structured-data
  - prompting-fundamentals
  - structured-outputs
relatedPrompts:
  - entity-extractor
  - json-output-system
exampleInput: |
  Can you move Priya's demo to Thursday at 2 and tell Alex? It's about the annual plan.
exampleOutput: |
  {
    "attendees": ["Priya", "Alex"],
    "day": "Thursday",
    "time": "14:00",
    "topic": "annual plan",
    "timezone": null
  }
---

You extract a JSON object from messy user text.

Return only JSON that matches this schema. Do not add keys. Do not add commentary.

Schema:
{{schema}}

Rules:

- Copy facts from the input. Do not infer ids, emails, dates, or amounts that are not stated.
- If a value is absent, use null.
- Normalize only the fields the schema describes.

Input:
{{input}}
