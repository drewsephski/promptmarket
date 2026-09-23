# @promptmarket/cli

Discover and install tested agent recipes from [PromptMarket](https://promptmarket.sh).

Requires Node.js 22 or newer.

## Install

```bash
pnpm add -D @promptmarket/cli
```

Or run it directly:

```bash
pnpm dlx @promptmarket/cli search "release readiness"
pnpm dlx @promptmarket/cli info github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review@0.1.0
pnpm dlx @promptmarket/cli install
```

`add` installs the recipe into `.agents/skills/` and records the version, registry source, and integrity hash in `promptmarket.lock`. `install` reinstalls the locked versions and does not change the lockfile.

## Commands

```bash
promptmarket search "pull request"
promptmarket info github-pr-review
promptmarket info github-pr-review@0.1.0
promptmarket versions github-pr-review
promptmarket add github-pr-review
promptmarket add github-pr-review@0.1.0
promptmarket install
promptmarket outdated
promptmarket validate ./recipes/github-pr-review/0.1.0
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

`install` uses the source recorded in `promptmarket.lock`. Pass `--recipes` when a locked entry came from a local recipe directory.

## MCP

Agents can use the hosted server at `https://promptmarket.sh/mcp`.
