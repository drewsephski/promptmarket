# PromptMarket

Tested agent recipes for AI coding agents. Install them with the CLI or load them through MCP.

```bash
pnpm dlx @promptmarket/cli search "release readiness"
pnpm dlx @promptmarket/cli info github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review@0.1.0
pnpm dlx @promptmarket/cli install
```

`add` writes the recipe to `.agents/skills/` and pins the version, source, and integrity hash in `promptmarket.lock`. `install` reproduces those exact versions.

The hosted registry is `https://promptmarket.sh/api/registry/v1`. Agents can use `https://promptmarket.sh/mcp`.
