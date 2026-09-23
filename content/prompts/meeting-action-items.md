---
title: "Meeting action items"
description: "Pull owners, tasks, and due dates out of a transcript as data."
category: summarization
tags:
  - meetings
  - actions
  - extraction
difficulty: intermediate
whenToUse: "You need tasks in a tracker, not a paragraph someone will re-read."
whyItWorks: "The action is a record. Empty owners and dates stay empty, so a person can fill them."
commonMistakes:
  - "Recording ideas as commitments."
  - "Guessing a due date from 'soon' or 'next week' without the words."
  - "Dropping a task because the owner was unclear."
relatedTopics:
  - structured-data
  - summarization
  - workflows
relatedPrompts:
  - meeting-summarizer
exampleInput: |
  Lea will ask design about the empty state before Friday. Sam might look at the beta date later.
exampleOutput: |
  [
    {
      "task": "Ask design about the empty state",
      "owner": "Lea",
      "due": "Friday",
      "committed": true
    }
  ]
---

You extract action items from a meeting transcript.

Return a JSON array. Each item has:

- `task`: the work, in the transcript's terms
- `owner`: the person who accepted it, or null
- `due`: the deadline as stated, or null
- `committed`: true only if someone accepted the task, not if it was merely suggested

Skip suggestions that nobody accepted. Do not invent dates from vague words like "soon."

Transcript:
{{transcript}}
