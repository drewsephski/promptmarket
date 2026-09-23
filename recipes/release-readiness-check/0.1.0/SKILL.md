---
name: release-readiness-check
description: Check whether a repository is ready to tag or deploy a release. Use when asked to assess release readiness before shipping.
---

# Release readiness check

Decide whether this repository can be tagged or deployed. Report blockers separately from follow-up work. Do not create the tag or deploy.

## Workflow

1. Identify the version that would ship: package manifest, changelog, and the current git status. Record uncommitted or untracked files that would be left out of the release.
2. Read the release notes or changelog section for that version. A missing note for a user-visible change is a blocker only when the repo already keeps a changelog.
3. Run the repo's documented verification commands: typecheck, lint, and test. Use the scripts in the manifest. Stop on the first failing command and include its relevant output.
4. Check that the version being released is the version the package or app will publish. Look for a hardcoded older version, a private package flag, or a publish config that would ship the wrong artifact.
5. Look for secrets in the paths that would be included: env files, credentials, and tokens that are not gitignored.
6. State the exact next command a human should run to tag or publish, without running it.

## Rules

- Do not run publish, deploy, or tag commands.
- Do not treat a warning as a blocker unless the repo's own check fails on warnings.
- Quote the command and the failing summary. Do not paste an entire successful log.
- If a check cannot be run because a tool is missing, say so and mark the release blocked until it can be run.

## Output

- Version and git state.
- Checks run, with pass or fail.
- Blockers.
- Non-blocking follow-ups.
- One line: `Release: blocked` or `Release: ready for a human to tag`.
