---
title: "What LLMs are good at"
module: uses
order: 1
summary: "Start from a job a language model can do, not from a feature name."
definition: "A useful LLM feature is a bounded language task: pull structure from text, label it, compress it, answer from supplied context, transform it, or choose an action."
mentalModel: "The model is a flexible reader and writer. It is not a database, a rules engine, or a guarantee."
why: "Teams get stuck when they begin with an architecture. The job comes first. The pattern follows from the job."
whenToUse:
  - "You can point at the text that goes in and the text or decision that should come out."
  - "A person could do the task with instructions, and you want that work to scale."
whenNotToUse:
  - "The task is exact calculation, authorization, or a lookup your system already stores."
  - "You cannot describe a correct answer."
relatedPrompts:
  - structured-data-extractor
  - intent-classifier
  - meeting-summarizer
  - language-translator
  - customer-support-answer
  - tool-selection-router
relatedTopics:
  - structured-data
  - classification
  - summarization
  - question-answering
  - agents
---

## Example

A support inbox does not need "an AI." It needs four smaller jobs:

1. Classify the ticket.
2. Extract the order number and product.
3. Draft an answer from the help center.
4. Decide whether a person should take over.

Each job has an input, an output, and a way to tell that the output is wrong. That is enough to build.

## Implementation notes

Name the job before you name the system. Structured data, classification, summarization, translation, question answering, and actions cover most product features that language models do well.

Keep the first version as one model call with a written output shape. Add retrieval, tools, or a loop only when that call cannot see what it needs or cannot do the next step itself.

Translation belongs on this list even without its own lesson. It is a transformation: same meaning, different surface form, with a glossary for terms you refuse to paraphrase.

## Common mistakes

- Starting from "we need agents" when the task is a single classification.
- Treating a fluent paragraph as evidence that the answer is grounded.
- Mixing extraction, policy, and a customer-facing reply in one prompt so no part can be tested.
