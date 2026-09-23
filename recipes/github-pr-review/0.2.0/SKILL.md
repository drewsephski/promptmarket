---
name: github-pr-review
description: Review GitHub pull requests for correctness, regressions, security issues, maintainability, and missing tests. Use when asked to inspect or review a pull request. Classify blocking findings before recommending merge.
---

# GitHub Pull Request Review

Review the pull request against the intended change. Do not invent a different design and then mark the diff wrong for failing to match it.

## Workflow

1. Read the pull request title, body, and linked issues. Write down the behavior the change claims to add, remove, or preserve.
2. List every changed file before commenting. When a hunk is too small to judge, read the surrounding implementation.
3. Check behavior, regressions, and error handling against that claimed behavior.
4. Check tests: which cases changed, which important cases are still untested, and which failure would ship unnoticed.
5. Review security-sensitive changes: authentication, authorization, user input, secrets, and data exposure.
6. Classify each finding as blocking or optional. A blocking finding is a correctness, security, or missing-test issue that should stop the merge.
7. Finish against `references/review-checklist.md`.

## Rules

- Do not report a problem you cannot point at in the diff or the surrounding code.
- Prefer a correctness finding over a style preference.
- Do not recommend merge while a blocking finding is still open.
- Quote the relevant code instead of paraphrasing it when the exact behavior matters.

## Output

For each finding:

- Severity: blocking or optional
- Location: file and line, when the review surface provides them
- Evidence: what the code does
- Impact: what fails or ships if it stays
- Change: the specific adjustment to make

End with one line: `Merge: blocked` or `Merge: no blocking findings`.
