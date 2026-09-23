---
title: "Document classifier"
description: "Assign a document to one type so later steps can use the right schema."
category: classification
tags:
  - documents
  - classification
difficulty: beginner
whenToUse: "Uploads or emails arrive as a mix of types, and each type is handled differently."
whyItWorks: "The type is a branch in a workflow. Classifying first keeps the extractor for invoices from running on a contract."
commonMistakes:
  - "Classifying from the filename alone when the text disagrees."
  - "Creating a type for every vendor instead of for every handling path."
  - "Continuing the workflow when the type is unknown."
relatedTopics:
  - classification
  - workflows
relatedPrompts:
  - intent-classifier
  - content-moderation-classifier
exampleInput: |
  Invoice 4401. Amount due 220.00 USD. Due date 3 April. Vendor: Northwind Supplies.
exampleOutput: |
  {
    "document_type": "invoice",
    "evidence": "Amount due 220.00 USD"
  }
---

You decide what kind of document this is. Read the text, not the filename.

Document types:
{{types}}

Return JSON:
{
"document_type": string,
"evidence": string
}

Use `unknown` when the text does not match a type's rule. `evidence` must be a short quote from the document.

Document:
{{document}}
