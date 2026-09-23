---
title: "Workflows"
module: patterns
order: 11
summary: "Split one problem into several predictable model calls."
definition: "A workflow is a fixed sequence of steps. You decide the order. The model does a small job at each step."
mentalModel: "An assembly line, not a colleague wandering the building. Each station has one job and a handoff."
why: "A single prompt that classifies, extracts, retrieves, and drafts will fail in ways you cannot attribute. Separate calls make the failure obvious."
whenToUse:
  - "The steps are known in advance, even if one step's output chooses a branch."
  - "You want to test or replace one step without touching the others."
whenNotToUse:
  - "The task really is one step. A workflow would only add latency."
  - "You cannot name the next step until the model has explored. That is a loop, and it costs more."
diagram: workflow
relatedPrompts:
  - support-ticket-triage
  - meeting-action-items
  - document-classifier
relatedTopics:
  - agentic-loops
---

## Example

Support reply, as a workflow:

1. Classify the ticket.
2. Extract the order id and product.
3. If the label is `billing`, retrieve the billing policy. Otherwise retrieve the product guide.
4. Draft the reply from that policy and the extracted fields.
5. A grader checks that the draft does not promise a refund the policy forbids.

You can unit-test step 1 without running step 4. When drafts go wrong, you can see whether the label was already wrong.

## Implementation notes

Pass structured output from one step into the next. Do not ask step 4 to re-read the whole ticket and redo classification "just in case."

Branches should be code. `if label === "billing"` is clearer than asking the model to "decide the whole process."

Record the intermediate objects. They are what you put in an eval when production misbehaves.

## Common mistakes

- Calling five steps a workflow when they are the same prompt repeated.
- Hiding a branch inside a paragraph instead of returning a label your code can route on.
- Adding a step you cannot score.
