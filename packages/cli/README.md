# @promptmarket/cli

Search lessons and prompts, or install agent skills, on [PromptMarket](https://promptmarket.sh).

Requires Node.js 22 or newer.

## Coding agent setup

Choose your client:

```bash
pnpm dlx @promptmarket/cli setup codex --write
pnpm dlx @promptmarket/cli setup opencode --write
pnpm dlx @promptmarket/cli setup cursor --write
pnpm dlx @promptmarket/cli setup claude-code --write
pnpm dlx @promptmarket/cli setup github-copilot --write
```

Each command configures the hosted MCP server in the client's project config and installs the same workflow guidance in its instruction file. Copilot setup targets VS Code. Existing unrelated settings and instructions are retained. Codex TOML formatting and comments are normalized when the config changes; OpenCode JSONC comments are preserved.

Omit `--write` for a preview, use `--check` to check project files, or `--remove` to remove the integration. `--dir` targets another project. Codex and OpenCode share a managed block in `AGENTS.md`, retained until both integrations are removed. Reload your client after setup; `--check` does not verify a live MCP connection. Codex requires project trust, and Claude Code may ask you to approve the project server.

Cursor retains its optional `--with-context7` installer handoff. For other clients, configure Context7 using its official setup instructions or read official library documentation directly. See [MCP setup](https://promptmarket.sh/docs/mcp) for all config formats and other clients.

Agents without remote MCP support can consume `context "your feature" --project . --format agent` through the CLI.

## Prompts and lessons

```bash
pnpm dlx @promptmarket/cli search "structured extraction"
pnpm dlx @promptmarket/cli show structured-data-extractor
pnpm dlx @promptmarket/cli learn rag
pnpm dlx @promptmarket/cli guides
pnpm dlx @promptmarket/cli guide ai-product-brief-builder
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

`add` installs the recipe into `.agents/skills/` and records the version, registry source, and integrity hash in `promptmarket.lock`. `install` reinstalls the locked versions and does not change the lockfile. If your agent does not discover `.agents/skills/`, ask it to read the installed `SKILL.md` or use its documented skill import mechanism.

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
