---
title: "Building AI products"
module: products
order: 16
summary: "Pick a useful problem, ship a small baseline, and let real failures decide the next change."
definition: "An AI product loop is: choose a job people already do, build the simplest version, put it in front of them, save the failures, score them, and improve."
mentalModel: "A workshop, not a launch. The product gets sharper because specific work went wrong and you kept the evidence."
why: "Users reveal the actual task. Your first prompt describes the task you imagined."
whenToUse:
  - "You are deciding what to build, or what to build next."
  - "The feature is in front of people and you need a cadence that is more than prompt tweaking."
whenNotToUse:
  - "You are still learning a single pattern. Read that lesson and copy one prompt before you design a platform."
  - "Nobody will look at the output. There is nothing to learn from a private demo that never fails."
relatedPrompts:
  - customer-support-answer
  - support-ticket-triage
  - response-quality-grader
relatedTopics:
  - optimization-ladder
---

## Example

A team wants to answer billing questions.

1. They pick that job, not "an assistant for everything."
2. The baseline pastes the relevant help article under the question and asks for a short answer that quotes the article.
3. Support agents see the draft beside the ticket and can send it or rewrite it.
4. Every rewrite is saved with the ticket text.
5. Ten rewrites become an eval: did the draft invent a refund, miss the plan name, or refuse a question the article answers?
6. They change the prompt, or they start retrieving articles instead of pasting one.
7. They run the ten again, then collect the next ten.

The retriever, the grader, and any tool come from step 6, not from the kickoff.

## Implementation notes

Put the baseline where a real input can reach it, even if a person still approves the output. Approval is a feature. It is also how you collect the dataset.

Name the failure modes in the language of the job: wrong policy, missing field, unsafe action. Generic "quality" is hard to fix.

Keep the loop smaller than the architecture. A weekly set of new failures plus the old regression set will outperform a month spent on infrastructure you cannot score.

## Common mistakes

- Building accounts, analytics, and a prompt marketplace before the first job works.
- Hiding the draft from the people who know the right answer.
- Expanding to a second use case before the first one has an eval.
