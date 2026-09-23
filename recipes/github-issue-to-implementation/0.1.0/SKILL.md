---
name: github-issue-to-implementation
description: Turn a GitHub issue into a scoped implementation plan and the corresponding code change. Use when asked to implement a GitHub issue.
---

# GitHub issue to implementation

Implement the issue that was named. Do not expand it into nearby work.

## Workflow

1. Load the issue. If `gh` is authenticated, run `gh issue view <number> --comments`. If it is not, use the issue text the user provided and say that comments were not loaded.
2. Restate the acceptance criteria as checks you can perform in this repo. If the issue has no acceptance criteria, derive the smallest check from the requested behavior and list assumptions.
3. Find the files that own that behavior before editing. Read them. Name the files in the plan.
4. Implement only those criteria. Match the surrounding style, tests, and module boundaries.
5. Add or update a test when the repo already tests that kind of behavior. Run the narrowest test command that covers the change, then the repo's typecheck if one exists.
6. Compare the result to the acceptance criteria. Anything not done stays listed as not done.

## Rules

- Do not close the issue, push a branch, or open a pull request unless the user asked for that step.
- Do not implement comments that speculate about a different feature.
- If the issue is ambiguous between two behaviors, stop and name the ambiguity instead of picking one silently.
- Keep the diff limited to the files the criteria require.

## Output

- Issue identifier and the acceptance criteria used.
- Files changed.
- Checks run and their results.
- Criteria that are still open, or `Criteria: met`.
