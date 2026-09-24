import type { Metadata } from "next";
import { DocsStart } from "../../components/docs-start";
import { pageMetadata } from "../../lib/present";

export const metadata: Metadata = pageMetadata(
  "Docs",
  "Install PromptMarket in Cursor, the CLI, MCP, or use it on the web.",
  "/docs",
);

export default function DocsPage() {
  return (
    <main className="docs product">
      <div className="hero-copy">
        <p className="eyebrow">Docs</p>
        <h1>How do you want to use PromptMarket?</h1>
      </div>
      <DocsStart />
      <p className="note">
        <a href="/docs/cli">All CLI commands</a>
        {" · "}
        <a href="/docs/mcp">MCP tools</a>
        {" · "}
        <a href="/recipes">Skills</a>
      </p>
    </main>
  );
}
