---
title: "Classification"
module: uses
order: 3
summary: "Assign an input to one label from a list you control."
definition: "Classification asks a model to choose among labels you defined, instead of writing an open-ended answer."
mentalModel: "You hand the model a menu. It points at one item, and it can say when nothing on the menu fits."
why: "Labels route work. A ticket, a document, or a user message becomes something your code can switch on."
whenToUse:
  - "The set of outcomes is known and small enough to list."
  - "A wrong label has a clear cost, so you can sample and score it."
whenNotToUse:
  - "The categories change every day and nobody can name them."
  - "You actually need the underlying fields, not a single bucket."
relatedPrompts:
  - intent-classifier
  - document-classifier
  - support-ticket-triage
  - content-moderation-classifier
relatedTopics:
  - what-llms-are-good-at
  - structured-outputs
---

## Example

Labels for a support message: `billing`, `bug`, `how_to`, `cancel`, `other`.

"I was charged twice and I want last month refunded" is `billing`. It is not `cancel` just because the customer is unhappy. The label list is the product decision. The model only picks.

Add `other` so the model has an honest way out. Then read what landed in `other`. That is how you discover a missing label.

## Implementation notes

Write each label with a one-line rule and one example that would be easy to confuse with a neighbor. "Billing means money movement. Cancel means ending the account, even if a refund is mentioned."

Return the label plus a short evidence quote from the input. The quote makes reviews faster and makes fabricated confidence obvious.

If two labels are often both right, change the task. Multi-label classification, or extraction of reasons, is clearer than forcing one bucket.

## Common mistakes

- Hiding the label rules and hoping the names are self-explanatory.
- Using dozens of overlapping labels on the first attempt.
- Treating the model's own "confidence" number as a probability you can threshold blindly.
