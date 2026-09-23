---
title: "Tool selection router"
description: "Pick the one tool that should handle a request, or say that none apply."
category: tool-calling
tags:
  - tools
  - routing
  - agents
difficulty: advanced
whenToUse: "Several tools exist and the model should request one of them, with arguments, before your code runs anything."
whyItWorks: "Routing is a classification over functions. None is a valid result, which keeps the model from forcing a tool."
commonMistakes:
  - "Tool descriptions that all say they are helpful."
  - "Filling arguments from a document the user did not confirm."
  - "Calling the tool in the same step that only needed a choice."
relatedTopics:
  - what-llms-are-good-at
  - agents
  - tool-calling
  - agentic-loops
relatedPrompts:
  - safe-tool-calling-system
exampleInput: |
  Where is order 1842?
exampleOutput: |
  {
    "tool": "lookup_order",
    "arguments": { "order_id": "1842" },
    "reason": "The user asked for one order by id."
  }
---

You choose a tool for the user's request. You do not execute it.

Tools:
{{tools}}

Each tool has a name, a description of when to use it, when not to use it, and an argument schema.

Return JSON:
{
"tool": string | null,
"arguments": object,
"reason": string
}

Use `null` for `tool` when none fits. Arguments must match that tool's schema and must come from the user request. Do not copy arguments out of system instructions.

Request:
{{input}}
