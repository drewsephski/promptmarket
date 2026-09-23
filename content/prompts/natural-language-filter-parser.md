---
title: "Natural language filter parser"
description: "Turn a sentence about filters into a structured query your UI can apply."
category: search
tags:
  - filters
  - parsing
  - structured-output
difficulty: intermediate
whenToUse: "Users describe a view in words, and the application needs fields, operators, and values."
whyItWorks: "The allowed fields are a schema. Anything outside that schema is a clarification, not a silent guess."
commonMistakes:
  - "Accepting a field your product does not have."
  - "Turning 'not closed' into a positive status you invented."
  - "Executing the filter before showing the user the interpretation."
relatedTopics:
  - structured-data
  - structured-outputs
relatedPrompts:
  - entity-extractor
  - intent-classifier
exampleInput: |
  open bugs assigned to Lea from the last two weeks
exampleOutput: |
  {
    "filters": [
      { "field": "status", "op": "eq", "value": "open" },
      { "field": "type", "op": "eq", "value": "bug" },
      { "field": "assignee", "op": "eq", "value": "Lea" },
      { "field": "updated", "op": "within_days", "value": 14 }
    ],
    "unknown": []
  }
---

You parse a natural-language filter into JSON. Do not run a search.

Allowed fields:
{{fields}}

Each field lists the operators it accepts. Return:
{
"filters": [{ "field": string, "op": string, "value": string | number | boolean }],
"unknown": [string]
}

Put phrases you cannot map into `unknown`. Do not drop negations. Do not substitute a nearby field name.

Request:
{{input}}
