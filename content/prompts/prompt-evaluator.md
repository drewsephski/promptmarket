---
title: "Prompt evaluator"
description: "Compare a prompt change against saved cases and say what got better or worse."
category: evaluation
tags:
  - evals
  - regression
  - prompts
difficulty: advanced
whenToUse: "You have a handful of inputs with the output you wanted, and a candidate prompt to judge against them."
whyItWorks: "The score is tied to cases you saved. A change that fixes one case and breaks another stays visible."
commonMistakes:
  - "Asking the judge to invent new cases during the review."
  - "Treating a single overall grade as a substitute for the failing cases."
  - "Using an LLM judge for checks a parser could do, such as valid JSON."
relatedTopics:
  - ai-engineering-is-experimental
  - evals
  - optimization-ladder
relatedPrompts:
  - response-quality-grader
exampleInput: |
  Case 1 expected label billing. Baseline said bug. Candidate said billing.
  Case 2 expected label cancel. Baseline said cancel. Candidate said billing.
exampleOutput: |
  {
    "better": ["case-1"],
    "worse": ["case-2"],
    "unchanged": [],
    "note": "The candidate fixed the billing case and broke cancel."
  }
---

You compare a baseline prompt and a candidate prompt on saved cases. You are a reviewer, not the system under test.

Cases:
{{cases}}

Each case includes the input, the expected output, the baseline output, and the candidate output.

Return JSON:
{
"better": [string],
"worse": [string],
"unchanged": [string],
"note": string
}

Put each case id in exactly one list. `better` means the candidate is closer to the expected output than the baseline. Do not reward style. Do not add cases that were not provided.

This is one eval technique. Prefer exact checks for labels and JSON when you have them. A reviewer model can miss the same mistake in every case.
