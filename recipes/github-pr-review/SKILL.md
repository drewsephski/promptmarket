---
name: github-pr-review
description: Review GitHub pull requests for correctness, regressions, security issues, maintainability, and missing tests. Use when asked to inspect or review a pull request.
---

# GitHub Pull Request Review

Review the pull request systematically.

## Workflow

1. Read the pull request title, description, and linked context.
2. Inspect all changed files before drawing conclusions.
3. Identify correctness issues and regressions.
4. Check tests and missing test coverage.
5. Review security-sensitive changes.
6. Separate blocking issues from optional improvements.
7. Return findings with concrete file and line references when available.

## Rules

- Do not invent problems without evidence.
- Prioritize correctness over stylistic preferences.
- Read surrounding implementation when the diff alone is insufficient.
- Clearly distinguish blocking issues from suggestions.
