---
title: "Question answering"
module: uses
order: 5
summary: "Answer a question from context you provide, and stop when that context is not enough."
definition: "Question answering asks a model to respond to a specific question using a source you pass in, rather than whatever it remembers from training."
mentalModel: "The model is taking an open-book test. If the passage is silent, the correct answer is that the passage is silent."
why: "Product answers have to be tied to your policies, docs, or data. A fluent answer from memory is a different product, and usually the wrong one."
whenToUse:
  - "The user asked a question and you can assemble the material that should decide the answer."
  - "Refusing or deferring is acceptable when the material does not cover it."
whenNotToUse:
  - "There is no source of truth, and a general explanation is what you want."
  - "The user needs a label or a field, not an explanation."
relatedPrompts:
  - rag-grounded-answer
  - answer-with-citations
  - customer-support-answer
  - search-query-rewriter
relatedTopics:
  - what-llms-are-good-at
  - summarization
  - rag
---

## Example

Question: "Can I change plans mid-cycle?"

Context: a help article that says plan changes apply on the next renewal, and a second article about refunds that does not mention plan changes.

A grounded answer says the change applies on the next renewal, and points at the plan article. It does not borrow refund rules to invent a prorated charge.

If neither article mentioned plan changes, the answer is: the supplied articles do not say.

## Implementation notes

Separate the question, the context, and the rules. Tell the model to use only the context for facts about your product. General language, such as how to format the reply, can live in the instructions.

Ask for a direct answer first, then the supporting detail. When you need auditability, require a citation per claim.

This lesson is the job. Retrieval, the step that fetches the context, is a later pattern. You can answer from context the user pasted before you build a retriever.

## Common mistakes

- Equating "the model knows this" with "our docs say this."
- Padding weak context with a long system prompt and hoping tone will hide the gap.
- Answering a how-to with a classification label, or the reverse.
