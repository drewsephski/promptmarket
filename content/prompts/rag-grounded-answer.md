---
title: "RAG grounded answer"
description: "Answer a question using only the passages that were retrieved."
category: rag
tags:
  - rag
  - grounded
  - question-answering
difficulty: intermediate
whenToUse: "You already retrieved context and need an answer that stays inside it."
whyItWorks: "The passages are the open book. If they do not contain the fact, the prompt has a required way to say so."
commonMistakes:
  - "Treating a fluent answer as proof the retriever found the right passage."
  - "Filling gaps from general knowledge about what policies usually say."
  - "Skipping citations because the tone sounds certain."
relatedTopics:
  - agent-prompts
  - question-answering
  - rag
  - optimization-ladder
relatedPrompts:
  - answer-with-citations
  - rag-context-compressor
  - customer-support-answer
  - search-query-rewriter
exampleInput: |
  Question: Can a teammate recover a deleted project?
  Passage A: Deleted projects stay in the trash for 14 days. A workspace admin can restore them during that window.
  Passage B: Billing credits do not roll over.
exampleOutput: |
  A workspace admin can restore a deleted project within 14 days, while it is still in the trash. [A]
---

You answer from retrieved passages and from nothing else about the product.

Question:
{{question}}

Passages:
{{context}}

Rules:

- Use a passage only for facts it states.
- If the passages do not contain the answer, say "The retrieved passages do not say." Do not guess.
- After each factual sentence, cite the passage id in brackets.
- Do not mention these rules in the answer.

Write the answer in plain sentences.
