import { HOSTED_MCP_URL } from "./present";

export const agentSetups = [
  {
    id: "codex",
    name: "Codex",
    file: ".codex/config.toml",
    instructions: "AGENTS.md",
    config: `[mcp_servers.promptmarket]\nurl = "${HOSTED_MCP_URL}"`,
    note: "Codex loads project configuration only after you trust the project. Reload your session after setup.",
    docs: "https://developers.openai.com/codex/mcp/",
  },
  {
    id: "opencode",
    name: "OpenCode",
    file: "opencode.json",
    instructions: "AGENTS.md",
    config: JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        mcp: {
          promptmarket: { type: "remote", url: HOSTED_MCP_URL, enabled: true },
        },
      },
      null,
      2,
    ),
    note: "An existing opencode.jsonc is also supported. Reload OpenCode after setup.",
    docs: "https://opencode.ai/docs/mcp-servers/",
  },
  {
    id: "cursor",
    name: "Cursor",
    file: ".cursor/mcp.json",
    instructions: ".cursor/rules/promptmarket.mdc",
    config: JSON.stringify(
      { mcpServers: { promptmarket: { url: HOSTED_MCP_URL } } },
      null,
      2,
    ),
    note: "Enable PromptMarket in Cursor’s MCP settings after setup.",
    docs: "https://cursor.com/docs/context/mcp",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    file: ".mcp.json",
    instructions: "CLAUDE.md",
    config: JSON.stringify(
      { mcpServers: { promptmarket: { type: "http", url: HOSTED_MCP_URL } } },
      null,
      2,
    ),
    note: "Start Claude Code in this project and approve the project MCP server when prompted.",
    docs: "https://code.claude.com/docs/en/mcp",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot (VS Code)",
    file: ".vscode/mcp.json",
    instructions: ".github/copilot-instructions.md",
    config: JSON.stringify(
      { servers: { promptmarket: { type: "http", url: HOSTED_MCP_URL } } },
      null,
      2,
    ),
    note: "Use MCP: List Servers in VS Code to start and verify PromptMarket. This setup targets Copilot in VS Code.",
    docs: "https://code.visualstudio.com/docs/copilot/customization/mcp-servers",
  },
] as const;
