# PromptMarket

Learn how AI apps actually work, then copy the prompt pattern you need.

Lessons and prompts live on the site. Coding agents can read the same material at `https://promptmarket.sh/mcp`. The CLI searches and prints that content.

```bash
pnpm dlx @promptmarket/cli search "structured extraction"
pnpm dlx @promptmarket/cli show structured-data-extractor
pnpm dlx @promptmarket/cli learn rag
```

Installable skills, such as a pull request review, are a separate catalog. `add` writes a skill to `.agents/skills/` and pins it in `promptmarket.lock`.

```bash
pnpm dlx @promptmarket/cli add github-pr-review
pnpm dlx @promptmarket/cli install
```

Publishing a skill opens a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).
