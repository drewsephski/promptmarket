# Coding agents and MCP

PromptMarket's content, workflow tools, and CLI are agent-independent. The hosted endpoint is `https://promptmarket.sh/mcp` and uses MCP Streamable HTTP. Configuration files and instruction discovery are specific to each client.

## Project setup

Run the command for the agent you use from your project directory:

| Agent                     | Command                                                   | MCP config                                   | Workflow instructions             |
| ------------------------- | --------------------------------------------------------- | -------------------------------------------- | --------------------------------- |
| Codex                     | `pnpm dlx @promptmarket/cli setup codex --write`          | `.codex/config.toml`                         | `AGENTS.md`                       |
| OpenCode                  | `pnpm dlx @promptmarket/cli setup opencode --write`       | `opencode.json` or existing `opencode.jsonc` | `AGENTS.md`                       |
| Cursor                    | `pnpm dlx @promptmarket/cli setup cursor --write`         | `.cursor/mcp.json`                           | `.cursor/rules/promptmarket.mdc`  |
| Claude Code               | `pnpm dlx @promptmarket/cli setup claude-code --write`    | `.mcp.json`                                  | `CLAUDE.md`                       |
| GitHub Copilot in VS Code | `pnpm dlx @promptmarket/cli setup github-copilot --write` | `.vscode/mcp.json`                           | `.github/copilot-instructions.md` |

Omit `--write` to preview. Use `--dir <project>` to target a directory, `--check` to check project files, or `--remove` to remove PromptMarket. These modes are mutually exclusive. `--check` does not connect to the server or inspect user/global overrides; reload your client and verify its tool list after setup.

Setup retains unrelated MCP servers and settings. JSON/JSONC edits retain comments. Codex TOML is parsed and rewritten when its server entry changes, retaining other settings but normalizing formatting and removing comments. Preview before applying if you maintain comments in that file. Invalid configuration is rejected before writes. Consolidate duplicate OpenCode JSON and JSONC configs before setup.

For Codex, OpenCode, Claude Code, and Copilot, setup manages only a marked PromptMarket block in the instruction file and preserves surrounding instructions. Codex and OpenCode share one block; removing either keeps that block while the other's project config still contains PromptMarket. Cursor retains its dedicated rule file behavior. All clients receive the same workflow guidance.

Context7 is optional. Use its [official setup instructions](https://github.com/upstash/context7#installation) for your client, or use official library docs directly. Cursor's existing `--with-context7` option still hands off to `npx --yes ctx7 setup --cursor --project`. It is not a cross-client installer flag.

## Manual remote configuration

Merge the relevant entry into your existing config. Do not replace unrelated settings.

### Codex

In `.codex/config.toml`:

```toml
[mcp_servers.promptmarket]
url = "https://promptmarket.sh/mcp"
```

Codex loads project config only for trusted projects. Reload the session and inspect MCP tools. For personal configuration, the same table can go in `~/.codex/config.toml`. See [Codex MCP](https://developers.openai.com/codex/mcp/) and [project configuration](https://developers.openai.com/codex/config-basic/).

### OpenCode

In `opencode.json` or `opencode.jsonc`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "promptmarket": {
      "type": "remote",
      "url": "https://promptmarket.sh/mcp",
      "enabled": true
    }
  }
}
```

Reload OpenCode and check `opencode mcp list`. See [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/).

### Cursor

In `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "promptmarket": { "url": "https://promptmarket.sh/mcp" }
  }
}
```

Enable the server in Cursor's MCP settings. See [Cursor MCP](https://cursor.com/docs/context/mcp).

### Claude Code

In `.mcp.json`:

```json
{
  "mcpServers": {
    "promptmarket": {
      "type": "http",
      "url": "https://promptmarket.sh/mcp"
    }
  }
}
```

Start Claude Code in the project and approve the server when prompted. Check `claude mcp get promptmarket`. See [Claude Code MCP](https://code.claude.com/docs/en/mcp).

### GitHub Copilot in VS Code

In `.vscode/mcp.json`:

```json
{
  "servers": {
    "promptmarket": {
      "type": "http",
      "url": "https://promptmarket.sh/mcp"
    }
  }
}
```

Use **MCP: List Servers** to start and verify the server. This configuration targets VS Code; other Copilot surfaces use their own configuration. See [VS Code MCP servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers).

### Other agents

Add a remote HTTP MCP server named `promptmarket` with the hosted endpoint using your client's documented schema. There is no universal MCP config file. Manual config connects the tools; it does not install workflow instructions.

If an agent cannot connect to remote MCP, give it the CLI's Markdown output:

```bash
pnpm dlx @promptmarket/cli context "add RAG over our documentation" --project . --format agent
pnpm dlx @promptmarket/cli plan "add RAG over our documentation" --project .
```

Skills installed with `add` live in `.agents/skills/`. Agents that do not discover that directory can read the installed `SKILL.md` explicitly or use their documented skill import mechanism. Recipe compatibility includes `opencode` and `generic`; published recipe versions remain immutable.

## Developing this repository

The checked-in client configs use the local stdio server so an agent can inspect your current checkout. From the repository root, install with `pnpm install` and build with `pnpm build`. Each config launches `node packages/mcp/bin/promptmarket-mcp.js`; run the client from this root. For another MCP client with stdio support, use that command and argument in its native configuration.

The hosted setup commands above are for consuming PromptMarket in other projects. Running them in this repository changes that client's local development entry to the hosted endpoint.
