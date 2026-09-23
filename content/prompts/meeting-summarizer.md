---
title: "Meeting summarizer"
description: "Brief someone who missed a meeting, without adding decisions that were not made."
category: summarization
tags:
  - meetings
  - summary
difficulty: beginner
whenToUse: "A transcript is longer than the reader will open, and they need decisions, open questions, and owners."
whyItWorks: "The sections tell the model what must survive compression, including the possibility that a section is empty."
commonMistakes:
  - "Turning discussion into decisions."
  - "Assigning an owner the transcript never named."
  - "Writing a narrative recap that hides the action list."
relatedTopics:
  - what-llms-are-good-at
  - summarization
relatedPrompts:
  - meeting-action-items
  - rag-context-compressor
exampleInput: |
  Sam: I think we should slip the beta. No one disagreed, but nobody confirmed a date. Lea will ask design about the empty state.
exampleOutput: |
  Decisions:
  - None confirmed.

  Open questions:
  - Whether the beta date moves.

  Actions:
  - Lea: ask design about the empty state. No date given.
---

You summarize a meeting for someone who was not there.

Write three sections, in this order: Decisions, Open questions, Actions. Use short bullets. If a section has nothing, write "None."

Rules:

- A decision requires explicit agreement, not a suggestion that went unchallenged.
- An action needs the owner named in the transcript. If the owner is missing, write "Unassigned."
- Keep dates, numbers, and negations as spoken.
- Do not add context from outside the transcript.

Transcript:
{{transcript}}
