---
title: "Response quality grader"
description: "Score one answer against a rubric and quote the failure."
category: evaluation
tags:
  - evals
  - grader
  - rubric
difficulty: advanced
whenToUse: "You need a repeatable critique of a draft, especially for qualities a parser cannot check."
whyItWorks: "The rubric is finite, and each miss includes a quote, so the grade is an argument rather than a mood."
commonMistakes:
  - "A rubric of ten vague adjectives."
  - "Letting the grader rewrite the answer instead of scoring it."
  - "Believing the grader when it shares the same blind spot as the drafter."
relatedTopics:
  - ai-engineering-is-experimental
  - evals
  - building-ai-products
relatedPrompts:
  - prompt-evaluator
exampleInput: |
  Policy: Refunds are not offered after 30 days.
  Draft: I have refunded your January payment.
  Rubric: Do not promise a refund the policy forbids.
exampleOutput: |
  {
    "pass": false,
    "failures": [
      {
        "rule": "Do not promise a refund the policy forbids.",
        "quote": "I have refunded your January payment."
      }
    ]
  }
---

You grade a draft. Do not rewrite it.

Rubric:
{{rubric}}

Source material the draft was allowed to use:
{{context}}

Draft:
{{draft}}

Return JSON:
{
"pass": boolean,
"failures": [{ "rule": string, "quote": string }]
}

`pass` is true only when every rubric rule holds. Each failure quotes the draft, not the rubric. If the draft adds a fact that is not in the source, that is a failure when the rubric forbids unsupported facts.

A model grader is not a measurement by itself. Keep exact checks beside it, and read a sample of grades.
