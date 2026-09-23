# @promptmarket/cli

Discover and install tested agent recipes from [PromptMarket](https://promptmarket.sh).

Requires Node.js 22 or newer.

## Install

```bash
pnpm add -D @promptmarket/cli
```

Or run it directly:

```bash
pnpm dlx @promptmarket/cli search "review a pull request"
pnpm dlx @promptmarket/cli info github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review
```

`add` installs the recipe into `.agents/skills/` and records the registry URL, version, and integrity hash in `promptmarket.lock`.

## Commands

```bash
promptmarket search "review a pull request"
promptmarket info github-pr-review
promptmarket add github-pr-review
promptmarket validate ./recipes/github-pr-review
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

## MCP

Agents can use the hosted server at `https://promptmarket.sh/mcp`.
