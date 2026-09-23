---
title: "Content moderation classifier"
description: "Flag a message against a short policy, and quote the part that triggered it."
category: moderation
tags:
  - moderation
  - policy
  - classification
difficulty: intermediate
whenToUse: "You need a first pass that routes illegal, abusive, or policy-breaking text to a person or a block."
whyItWorks: "The categories are a policy you wrote. The quote shows the trigger, and allow is the default when nothing matches."
commonMistakes:
  - "A category so broad that ordinary complaints are flagged."
  - "Flagging without a quote, which nobody can review."
  - "Using the classifier as the only control on a high-cost action."
relatedTopics:
  - classification
relatedPrompts:
  - document-classifier
  - support-ticket-triage
exampleInput: |
  I will post your home address unless you refund me today.
exampleOutput: |
  {
    "decision": "review",
    "category": "threat",
    "quote": "I will post your home address"
  }
---

You moderate one message against the policy. Do not reply to the user.

Policy categories:
{{categories}}

Return JSON:
{
"decision": "allow" | "review" | "block",
"category": string | null,
"quote": string | null
}

Choose `allow` when no category's rule matches. Choose `review` when a person should see it. Choose `block` only for categories the policy marks as block. `quote` is the triggering span, or null when the decision is allow.

Message:
{{input}}
