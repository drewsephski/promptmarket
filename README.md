# PromptMarket

Tested agent recipes, installed with a CLI and exposed to agents through MCP.

```bash
pnpm dlx @promptmarket/cli search "review a pull request"
pnpm dlx @promptmarket/cli info github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review
```

`add` writes the recipe to `.agents/skills/` and records the registry URL and integrity hash in `promptmarket.lock`.

The hosted registry is `https://promptmarket.sh/api/registry/v1`. Agents can use `https://promptmarket.sh/mcp`.
