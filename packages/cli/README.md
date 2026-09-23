# @promptmarket/cli

Search lessons and prompts, or install agent skills, on [PromptMarket](https://promptmarket.sh).

Requires Node.js 22 or newer.

## Prompts and lessons

```bash
pnpm dlx @promptmarket/cli search "structured extraction"
pnpm dlx @promptmarket/cli show structured-data-extractor
pnpm dlx @promptmarket/cli learn rag
```

## Install

```bash
pnpm add -D @promptmarket/cli
```

Or run it directly:

```bash
pnpm dlx @promptmarket/cli search "pull request"
pnpm dlx @promptmarket/cli add github-pr-review
```

## Consume

```bash
pnpm dlx @promptmarket/cli search "pull request"
pnpm dlx @promptmarket/cli info github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review@0.1.0
pnpm dlx @promptmarket/cli install
```

`add` installs the recipe into `.agents/skills/` and records the version, registry source, and integrity hash in `promptmarket.lock`. `install` reinstalls the locked versions and does not change the lockfile.

## Author

```bash
pnpm dlx @promptmarket/cli init my-recipe
pnpm dlx @promptmarket/cli check ./my-recipe
pnpm dlx @promptmarket/cli pack ./my-recipe
```

`init` writes `promptmarket.yaml` and `SKILL.md` in a new directory. Pass `--description`, `--author`, and `--compatibility` to skip prompts. The recipe version defaults to `0.1.0`; set it with `--recipe-version` (`promptmarket --version` prints the CLI version). Add `--json` for stable JSON.

`check` is the author-facing validation report. `validate` remains available and keeps its existing JSON shape. `pack` writes `<name>-<version>.tgz` using the registry integrity digest. From the parent directory that archive is `dist/<name>-<version>.tgz`. From inside the recipe it is written to the parent `dist/` directory so the archive is not part of the package `submit` publishes.

## Submit

```bash
pnpm dlx @promptmarket/cli submit ./my-recipe
```

This forks `drewsephski/promptmarket` with the GitHub CLI, commits the new version directory, and opens a pull request. Install `gh` and run `gh auth login` first. The CLI does not ask for a token.

```bash
pnpm dlx @promptmarket/cli submit ./my-recipe --dry-run --json
```

`--dry-run` validates the recipe and checks the registry. It does not fork, push, or open a pull request.

## Commands

```bash
promptmarket search "pull request"
promptmarket info github-pr-review
promptmarket info github-pr-review@0.1.0
promptmarket versions github-pr-review
promptmarket add github-pr-review
promptmarket install
promptmarket outdated
promptmarket validate ./my-recipe
promptmarket check ./my-recipe
promptmarket init my-recipe
promptmarket pack ./my-recipe
promptmarket submit ./my-recipe
```

Add `--json` to any command for deterministic JSON on stdout.

## Registry

The CLI uses `https://promptmarket.sh/api/registry/v1` unless you point it somewhere else:

```bash
promptmarket search "review" --registry https://promptmarket.sh/api/registry/v1
```

For local development, read a recipe directory instead of the network:

```bash
promptmarket search "review" --recipes ./recipes
```

`install` uses the source recorded in `promptmarket.lock`. Pass `--recipes` when a locked entry came from a local recipe directory. `submit --recipes` checks that directory instead of the hosted registry.

## MCP

Agents can use the hosted server at `https://promptmarket.sh/mcp`.
