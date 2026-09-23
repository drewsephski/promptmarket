---
title: "RAG context compressor"
description: "Shorten retrieved passages without dropping the sentences that answer the question."
category: rag
tags:
  - rag
  - context
  - compression
difficulty: intermediate
whenToUse: "Retrieved text is too long for the answer prompt, and you still need the lines that carry the rule."
whyItWorks: "Compression is a filter with a question in mind. It keeps evidence and discards scene-setting."
commonMistakes:
  - "Summarizing so hard that numbers and exceptions disappear."
  - "Merging two passages into a claim neither one made."
  - "Compressing before you have checked that the right passage was retrieved at all."
relatedTopics:
  - summarization
  - rag
relatedPrompts:
  - meeting-summarizer
  - rag-grounded-answer
exampleInput: |
  Question: How long are deleted projects recoverable?
  Passage: Projects are containers for files. Deleted projects stay in the trash for 14 days. Admins restore them from trash. The trash view also shows who deleted the project.
exampleOutput: |
  [passage-1] Deleted projects stay in the trash for 14 days. Admins restore them from trash.
---

You compress retrieved passages for a later answer step. Do not answer the question yourself.

Question:
{{question}}

Passages:
{{context}}

For each passage, keep only the sentences that the question needs. Preserve numbers, conditions, and exceptions word for word. Drop introductions, navigation, and unrelated sections.

Return one block per passage, starting with its id. If a passage has nothing relevant, return its id and the word "irrelevant."

Do not combine passages into a new claim.
