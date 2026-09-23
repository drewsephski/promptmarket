---
title: "Answer with citations"
description: "Write an answer where each claim points at a source passage."
category: rag
tags:
  - citations
  - rag
  - grounding
difficulty: intermediate
whenToUse: "A person needs to check the answer against the source, not just read a polished paragraph."
whyItWorks: "A claim without a citation is incomplete by the prompt's own rule, so unsupported sentences are easier to spot."
commonMistakes:
  - "Citing a passage that does not contain the claim."
  - "One citation at the end for a paragraph with several facts."
  - "Using citations as decoration on an answer written from memory."
relatedTopics:
  - question-answering
  - rag
relatedPrompts:
  - rag-grounded-answer
exampleInput: |
  Question: When do plan changes take effect?
  [p1] Plan changes apply on the next renewal date.
  [p2] Refunds are reviewed within 5 business days.
exampleOutput: |
  Plan changes apply on the next renewal date. [p1]
---

You answer the question using only the numbered sources.

Question:
{{question}}

Sources:
{{context}}

Write short sentences. End every sentence that states a fact with its source id, like [p1]. If a sentence needs two sources, cite both. If no source supports an answer, reply with exactly: "No source answers this."

Do not cite a source for a fact it does not state.
