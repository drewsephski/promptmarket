---
name: repo-onboarding
description: Map an unfamiliar repository for a new contributor. Use when asked to onboard, explain how a codebase is structured, or find where a change should land.
---

# Repository onboarding

Produce a map of this repository from the files and commands that are actually here. Do not describe a generic project of the same framework.

## Workflow

1. Read the root manifest files first: README, package manager config, workspace config, and the top-level source directories.
2. Identify the runtime entry points: applications, packages, services, and the commands that build, test, and start them.
3. Trace one vertical path from an external entry point to the module that owns the behavior. Name the files.
4. Note the conventions that a change must follow: language, test location, schema or API boundaries, and generated files that should not be edited.
5. List the checks a contributor should run before opening a change, using the scripts defined in the repo.

## Rules

- Prefer `rg` and directory listings over reading entire trees.
- If a command is required to understand the layout, run the repo's own script rather than inventing one.
- Say when a directory's purpose is not evident from the files. Do not fill the gap with a guess.
- Do not modify files. This recipe is read-only orientation.

## Output

- What the repo is for, in one paragraph grounded in the README or entry points.
- Directory map: path, responsibility, and whether it is an app, library, or config.
- How to build and test, with the exact commands from the manifest.
- Where a typical change lands, with one concrete example path.
- Unknowns that still need a human.
