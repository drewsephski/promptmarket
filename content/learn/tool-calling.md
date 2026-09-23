---
title: "Tool calling"
module: patterns
order: 10
summary: "Give the model a list of actions it can request."
definition: "Tool calling is a structured request: the model picks a tool you defined and fills that tool's arguments. Your code runs the tool, if it should run at all."
mentalModel: "You published a short menu of functions. The model fills in a function call. It does not reach past the menu."
why: "Text cannot query a database or file a bug. A tool can, and the request is data you can validate before anything happens."
whenToUse:
  - "The model needs a capability your application has: search, read, write, or notify."
  - "The arguments are specific enough to check."
whenNotToUse:
  - "You are still deciding what the feature should do. A prompt with no tools will teach you faster."
  - "The 'tool' would be an open-ended shell with no schema."
diagram: tools
relatedPrompts:
  - tool-selection-router
  - safe-tool-calling-system
relatedTopics:
  - agents
  - agentic-loops
---

## Example

Tools:

- `search_docs(query)`
- `lookup_order(order_id)`
- `handoff(reason)`

"Where is order 1842?" should become `lookup_order` with `order_id: "1842"`, not a paragraph guessing the warehouse. "This sounds like a legal threat" should become `handoff`, not a creative reply.

If none of the tools apply, the model says so. That is a successful decision.

## Implementation notes

Write tools the way you write internal functions. Include a description of when not to use each one. Similar tools need a contrast: search finds documents, lookup finds one order by id.

Validate arguments before execution. An order id that fails your format never reaches the database. Return the tool result to the model only if a later step needs it.

Authorization is yours. The model can request `refund_order`. Your code decides whether this user, this order, and this amount are allowed.

## Common mistakes

- One giant tool whose argument is "the user's request."
- Descriptions that overlap so completely the model is guessing.
- Executing the call before checking that the arguments came from the user and not from a passage you retrieved.
