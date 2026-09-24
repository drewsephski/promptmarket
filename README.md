# PromptMarket

Learn how AI apps actually work, then copy the prompt pattern you need.

Lessons, guides, and prompts live on the site. Coding agents can read the same material at `https://promptmarket.sh/mcp`. The CLI searches and prints that content.

```bash
pnpm dlx @promptmarket/cli detect
pnpm dlx @promptmarket/cli context "add RAG over our documentation" --project .
pnpm dlx @promptmarket/cli search "structured extraction"
pnpm dlx @promptmarket/cli show structured-data-extractor
pnpm dlx @promptmarket/cli learn rag
pnpm dlx @promptmarket/cli guide ai-product-brief-builder
```

The CLI reads the latest catalog from `https://promptmarket.sh/api/content/v1`, reuses a local cache when the content version has not changed, and falls back to the bundled snapshot if the network is unavailable. `--offline` skips the network. `detect` reads `package.json`, the lockfile, and a few config filenames in the project directory. It does not read source files or `.env`.

Installable skills, such as a pull request review, are a separate catalog. `add` writes a skill to `.agents/skills/` and pins it in `promptmarket.lock`.

```bash
pnpm dlx @promptmarket/cli add github-pr-review
pnpm dlx @promptmarket/cli install
```

Publishing a skill opens a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).
