---
title: "RAG"
module: patterns
order: 9
summary: "Fetch useful information first, then include it in the model's context."
definition: "Retrieval-augmented generation finds passages that might answer the question and places those passages in the prompt before the model writes."
mentalModel: "Look it up, then ask. The model answers from what you just handed it, not from a private memory of your docs."
why: "Your policies, tickets, and code change faster than a training run. Retrieval lets the answer follow the current source."
whenToUse:
  - "The answer depends on material the model was not given in the question itself."
  - "You can store that material in a place you can search: docs, tickets, tables, or files."
whenNotToUse:
  - "The user already pasted the only source that matters."
  - "The task is extraction or classification of that same message, and nothing else is required."
diagram: rag
relatedPrompts:
  - rag-grounded-answer
  - rag-context-compressor
  - answer-with-citations
  - search-query-rewriter
  - customer-support-answer
relatedTopics:
  - question-answering
  - evals
---

## Example

A user asks "What is our retention period for deleted projects?"

1. Rewrite the question into a search query if the wording is conversational.
2. Retrieve the two or three policy chunks that mention deletion and retention.
3. Prompt the model with the question plus those chunks.
4. Answer only from the chunks, with a citation, or say the chunks do not cover it.

The search step can be boring keyword search. It does not have to be a vector database to count as RAG.

## Implementation notes

Treat retrieval and answering as separate steps you can inspect. Log the query, the chunk ids, and the answer. When the answer is wrong, check whether the right chunk was missing before you rewrite the answer prompt.

Stuff fewer, better chunks. A compressor can shorten a long passage, but it should not drop the sentence that contains the rule.

Citations are how a person audits the reply. They are not proof the retriever is good. You still need questions where you know which document should have been found.

## Common mistakes

- Retrieving a pile of vaguely related text and hoping the model will "figure it out."
- Letting the model answer from memory when retrieval returns nothing.
- Judging the feature by how sophisticated the index is, instead of by whether the right fact showed up.
