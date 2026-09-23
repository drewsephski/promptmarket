# PromptMarket

Validated agent recipes for AI coding agents. Install them with the CLI, load them through MCP, or publish a new version with a GitHub pull request.

The hosted registry is `https://promptmarket.sh/api/registry/v1`. Agents can use `https://promptmarket.sh/mcp`.

## Consume

```bash
pnpm dlx @promptmarket/cli search "pull request"
pnpm dlx @promptmarket/cli add github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review@0.1.0
pnpm dlx @promptmarket/cli install
```

`add` writes the recipe to `.agents/skills/` and pins the version, source, and integrity hash in `promptmarket.lock`. `install` reproduces those exact versions.

## Author

```bash
pnpm dlx @promptmarket/cli init my-recipe
pnpm dlx @promptmarket/cli check ./my-recipe
pnpm dlx @promptmarket/cli pack ./my-recipe
```

`init` creates a local authoring directory with `promptmarket.yaml` and `SKILL.md`. It does not install the recipe into `.agents/skills`.

## Submit

```bash
pnpm dlx @promptmarket/cli submit ./my-recipe
```

Submission opens a pull request against `drewsephski/promptmarket`. It requires the GitHub CLI (`gh`) and `gh auth login`. `submit --dry-run` validates the package and checks that the version is not already in the registry.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the immutability rules.

## MCP

`https://promptmarket.sh/mcp`

## Registry checks

```bash
pnpm recipes:check
pnpm recipes:check -- --base <sha>
```
