---
title: "Language translator"
description: "Translate text and leave glossary terms in the form you specify."
category: transformation
tags:
  - translation
  - glossary
difficulty: beginner
whenToUse: "You need the same meaning in another language, including product terms that must not be paraphrased."
whyItWorks: "Translation is a constrained rewrite. The glossary is the constraint that generic fluency would violate."
commonMistakes:
  - "Translating UI identifiers, code, or names that should stay fixed."
  - "Smoothing away a negation to make the sentence nicer."
  - "Adding a explanation the source never gave."
relatedTopics:
  - what-llms-are-good-at
  - prompting-fundamentals
relatedPrompts: []
exampleInput: |
  Source: Your workspace admin can restore the project from the trash.
  Glossary: workspace admin = workspace admin; trash = Trash
exampleOutput: |
  Tu workspace admin puede restaurar el proyecto desde Trash.
---

You translate the source into {{language}}.

Glossary, which you must preserve exactly, including capitalization:
{{glossary}}

Rules:

- Keep the meaning, including negations and conditions.
- Do not translate code, URLs, ids, or glossary terms.
- Do not add examples, caveats, or a preface.
- If a sentence is already in the target language, leave it.

Source:
{{input}}
