# PromptMarket

Learn how AI apps actually work, then copy the prompt pattern you need.

Lessons, guides, and prompts live on the site. Coding agents can read the same material at `https://promptmarket.sh/mcp`. The CLI searches and prints that content.

```bash
pnpm dlx @promptmarket/cli setup cursor --write
pnpm dlx @promptmarket/cli setup cursor --write --with-context7
pnpm dlx @promptmarket/cli detect
pnpm dlx @promptmarket/cli doctor
pnpm dlx @promptmarket/cli context "add RAG over our documentation" --project . --format agent
pnpm dlx @promptmarket/cli plan "add RAG over our documentation" --project .
pnpm dlx @promptmarket/cli verify init "add RAG over our documentation" --project .
pnpm dlx @promptmarket/cli verify run
pnpm dlx @promptmarket/cli search "structured extraction"
pnpm dlx @promptmarket/cli show structured-data-extractor
pnpm dlx @promptmarket/cli learn rag
pnpm dlx @promptmarket/cli guide ai-product-brief-builder
```

The CLI reads the latest catalog from `https://promptmarket.sh/api/content/v1`. A cache younger than 15 minutes is used immediately. After that, the CLI revalidates with an ETag. If the network fails, it uses the stale cache, then the bundled snapshot. `--refresh` skips the freshness window. `--offline` skips the network. `setup cursor --write` merges the hosted MCP server into `.cursor/mcp.json` and adds an Apply Intelligently rule. `--with-context7` hands off to Context7's official Cursor setup when that server is not already configured. `research` is optional: it reconciles a plan with live docs through the Context7 SDK and needs `CONTEXT7_API_KEY`. `plan` does not. `verify init` writes a thin Promptfoo suite from the plan's eval target. `verify run` and `verify view` delegate to Promptfoo. `detect` reads `package.json`, the lockfile, and a few config filenames in the project directory. It does not read source files or `.env`.

A feature description can also be resolved in the browser at `/context`. That page uses the same catalog lookup as the CLI and does not call a model.

Installable skills, such as a pull request review, are a separate catalog. `add` writes a skill to `.agents/skills/` and pins it in `promptmarket.lock`.

```bash
pnpm dlx @promptmarket/cli add github-pr-review
pnpm dlx @promptmarket/cli install
```

Publishing a skill opens a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).
