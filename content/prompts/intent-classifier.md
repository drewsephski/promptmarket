---
title: "Intent classifier"
description: "Choose one label from a fixed list for a user message."
category: classification
tags:
  - classification
  - intent
  - labels
difficulty: beginner
whenToUse: "You know the labels, and the next step in your app depends on which one fits."
whyItWorks: "A closed list plus a quote from the message makes the choice reviewable. Other is an explicit escape."
commonMistakes:
  - "Overlapping label names with no rule that separates them."
  - "Omitting an other bucket, which forces a wrong label."
  - "Routing on the label before anyone has checked a sample of real messages."
relatedTopics:
  - what-llms-are-good-at
  - classification
  - structured-outputs
relatedPrompts:
  - json-output-system
  - support-ticket-triage
  - document-classifier
  - natural-language-filter-parser
exampleInput: |
  I was charged twice in March and I want that second payment back.
exampleOutput: |
  {
    "label": "billing",
    "evidence": "charged twice in March"
  }
---

You classify a user message. Pick exactly one label from the list.

Labels:
{{labels}}

Each label is written as a name and a one-line rule. If two labels seem possible, choose the one whose rule matches the user's requested outcome. If none match, use `other`.

Return JSON:
{
"label": string,
"evidence": string
}

`evidence` is a short quote from the message, not a paraphrase and not a confidence score.

Message:
{{input}}
