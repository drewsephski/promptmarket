import type { Metadata } from "next";
import { CommandBlock } from "../../../components/command-block";
import { HOSTED_MCP_URL, pageMetadata } from "../../../lib/present";

export const metadata: Metadata = pageMetadata(
  "MCP",
  "PromptMarket MCP tools for workflow, context, plans, and content.",
  "/docs/mcp",
);

const cursorConfig = `{
  "mcpServers": {
    "promptmarket": {
      "url": "${HOSTED_MCP_URL}"
    }
  }
}`;

export default function McpDocsPage() {
  return (
    <main className="docs product">
      <div className="hero-copy">
        <p className="eyebrow">Docs</p>
        <h1>MCP</h1>
        <p className="lede">
          The tools search and return content. They do not rank with a model.{" "}
          <a href="/docs">Back to setup</a>
        </p>
      </div>
      <CommandBlock command={HOSTED_MCP_URL} label="Copy MCP endpoint" />
      <p className="note">Cursor remote MCP config:</p>
      <CommandBlock command={cursorConfig} label="Copy Cursor MCP config" />
      <div className="docs-prose">
        <p>
          Primary tools: <code>get_workflow</code>, <code>build_context</code>,{" "}
          <code>build_plan</code>, <code>search_prompts</code>,{" "}
          <code>get_prompt</code>, <code>search_learn</code>,{" "}
          <code>get_learn_topic</code>, <code>search_guides</code>,{" "}
          <code>get_guide</code>, and <code>recommend_prompt</code>.
        </p>
        <p>
          <code>build_context</code> assembles the lesson, prompt, guide, and
          skill for a feature in one call. <code>recommend_prompt</code> returns
          one match only when the wording is specific.
        </p>
        <p>
          Skill tools remain available: <code>search_recipes</code>,{" "}
          <code>inspect_recipe</code>, <code>get_recipe</code>, and{" "}
          <code>list_recipe_versions</code>. Browse them on{" "}
          <a href="/recipes">Skills</a>.
        </p>
      </div>
    </main>
  );
}
