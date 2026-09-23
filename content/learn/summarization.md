---
title: "Summarization"
module: uses
order: 4
summary: "Compress text while keeping the parts a specific reader needs."
definition: "Summarization asks a model to produce a shorter account of a source, for a reader you name, without adding claims."
mentalModel: "You are briefing a colleague who will not read the original. The brief is only as good as the questions you told them to answer."
why: "People do not need every sentence. They need the decision, the risk, or the next step. A summary that answers those is a feature. A vague recap is not."
whenToUse:
  - "The source is longer than the reader will open."
  - "You can say what must survive compression: decisions, numbers, owners, dates."
whenNotToUse:
  - "The reader needs every detail, or the source is already short."
  - "You need the answer to a question the source may not contain. That is question answering."
relatedPrompts:
  - meeting-summarizer
  - meeting-action-items
  - rag-context-compressor
relatedTopics:
  - what-llms-are-good-at
  - question-answering
---

## Example

A meeting transcript becomes three blocks, not a mood piece:

- Decisions: what was agreed.
- Open questions: what was not.
- Actions: who does what, and by when, or "unassigned" if nobody volunteered.

If the transcript never named an owner, the summary says so. It does not pick the most senior person in the room.

## Implementation notes

State the reader and the maximum length. "For an engineer who missed the meeting, under 150 words, plus a list of actions." Ask the model to keep numbers, names, and negations exactly.

When the source is a set of retrieved passages, summarize each passage before you ask a question. That is compression in service of retrieval, not a substitute for citing the source.

Compare the summary to the source on a handful of real documents. Look for added causes, softened refusals, and dropped dates.

## Common mistakes

- Asking for "a short summary" with no audience and no required facts.
- Letting the model resolve ambiguity that the speakers left open.
- Summarizing retrieved snippets so aggressively that the answer step can no longer see the evidence.
