# Contributing to PromptMarket

PromptMarket publishes recipes by merging pull requests. There is no account, database, or separate publish API.

## Coding agents

Use any coding agent. [Agent setup](docs/agents.md) documents native MCP configuration for Codex, OpenCode, Cursor, Claude Code, and Copilot, plus CLI access for other agents. The checked-in configs connect to this checkout's local stdio server after building.

Recipe compatibility accepts `cursor`, `claude-code`, `codex`, `opencode`, `github-copilot`, and `generic`. Use `generic` for agent-independent instructions. Do not edit published recipe versions just to add an agent label; publish a new version when metadata changes.

## Add a recipe

```bash
pnpm dlx @promptmarket/cli init my-recipe
cd my-recipe
# edit SKILL.md
pnpm dlx @promptmarket/cli check .
pnpm dlx @promptmarket/cli pack .
pnpm dlx @promptmarket/cli submit .
```

`submit` uses an authenticated [GitHub CLI](https://cli.github.com). It forks `drewsephski/promptmarket`, commits only `recipes/<name>/<version>/`, and opens a pull request against `main`.

You can also build the package at [promptmarket.sh/create](https://promptmarket.sh/create), download it, and run `submit` on that directory.

## Immutable versions

A version directory that has merged to `main` cannot be edited or deleted. Add a new version directory instead.

```text
recipes/my-recipe/0.1.0/
```

CI runs `pnpm recipes:check` and compares the pull request with its base commit. It fails if a published version's bytes change.

## Checks

Pull requests run lint, types, tests, the production build, and the recipe immutability check.
