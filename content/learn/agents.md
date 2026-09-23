---
title: "Agents and actions"
module: uses
order: 6
summary: "Let a model request an action your application knows how to perform."
definition: "An action-taking system gives the model a list of operations and lets it ask for one, while your code decides whether to run it."
mentalModel: "The model writes a work order. Your application is the only thing that can carry it out."
why: "Some jobs are not finished when text comes back. Filing an issue, running a query, or sending a reply needs a side effect, and side effects need a boundary."
whenToUse:
  - "The next step is a real operation: search, write, call an API, or hand off to a person."
  - "You can name the allowed operations and reject everything else."
whenNotToUse:
  - "A single answer or a JSON object would finish the job."
  - "You cannot explain what the model is allowed to do."
diagram: agent
relatedPrompts:
  - tool-selection-router
  - safe-tool-calling-system
relatedTopics:
  - what-llms-are-good-at
  - tool-calling
  - agentic-loops
---

## Example

A user says "ship the changelog to the release channel."

The model does not post anywhere. It returns a request:

```json
{ "tool": "post_message", "channel": "releases", "text": "..." }
```

Your code checks that `post_message` is allowed, that the channel is on a list, and that a person confirmed it if the text leaves the building. Then your code performs the post.

## Implementation notes

Start with one action and a schema for its arguments. Describe the action the way you would describe a function to a new teammate: what it does, what it must not do, and what the arguments mean.

Keep the model on the requesting side of the boundary. Credentials, permissions, and network calls stay in your process.

If the model needs the result before it can continue, you are in an agentic loop. If one request is enough, do not build the loop.

## Common mistakes

- Giving the model a shell, a browser, and a blank objective because that feels more capable.
- Describing tools as marketing names instead of as functions with arguments.
- Confusing "the model suggested an action" with "the action happened."
