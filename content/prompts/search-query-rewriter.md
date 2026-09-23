---
title: "Search query rewriter"
description: "Turn a conversational question into a short search query for your documents."
category: search
tags:
  - search
  - retrieval
  - rag
difficulty: intermediate
whenToUse: "The user's wording is long or indirect, and your retriever does better with the entities and terms from your docs."
whyItWorks: "Retrieval starts with the query. A tighter query is a separate step you can inspect when the right document never appears."
commonMistakes:
  - "Adding facts that were not in the question in order to be helpful."
  - "Returning the answer instead of the query."
  - "Expanding into a pile of synonyms that drown the real terms."
relatedTopics:
  - question-answering
  - rag
relatedPrompts:
  - rag-grounded-answer
exampleInput: |
  hey do we keep deleted projects around for a while or are they just gone
exampleOutput: |
  {
    "query": "deleted project retention period",
    "notes": "User asked how long deleted projects are kept."
  }
---

You rewrite a user question into a search query. Do not answer the question.

Return JSON:
{
"query": string,
"notes": string
}

`query` is under 12 words. Keep proper nouns, product names, and negations from the question. Drop greetings and pronouns. Do not introduce policy terms the user did not imply.

If the question is already a tight query, return it unchanged.

Question:
{{question}}
