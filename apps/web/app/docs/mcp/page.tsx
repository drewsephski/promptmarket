import type { Metadata } from "next";
import { agentSetups } from "../../../lib/agent-setup";
import { CommandBlock } from "../../../components/command-block";
import { HOSTED_MCP_URL, pageMetadata } from "../../../lib/present";

export const metadata: Metadata = pageMetadata(
  "MCP",
  "PromptMarket MCP tools for workflow, context, plans, and content.",
  "/docs/mcp",
);

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
      <div className="docs-prose">
        <p>
          Connect any client that supports remote MCP over Streamable HTTP. Use
          the configuration format for your agent; merge the entry into an
          existing file instead of replacing your other settings.
        </p>
      </div>
      {agentSetups.map((agent) => (
        <section key={agent.id} id={agent.id} className="docs-prose">
          <h2>{agent.name}</h2>
          <p>
            Project config: <code>{agent.file}</code>
          </p>
          <CommandBlock
            command={agent.config}
            label={`Copy ${agent.name} MCP config`}
          />
          <p>
            {agent.note} <a href={agent.docs}>Official setup docs</a>
          </p>
        </section>
      ))}
      <div className="docs-prose">
        <h2>Other agents</h2>
        <p>
          Add a remote HTTP MCP server named <code>promptmarket</code> with the
          endpoint above, using your client’s settings or config schema. These
          formats are client-specific; there is no universal MCP config file.
        </p>
        <p>
          If your agent has no remote MCP support, pass it context from the CLI:
        </p>
        <CommandBlock
          command={
            'pnpm dlx @promptmarket/cli context "add RAG over our documentation" --project . --format agent'
          }
          label="Copy agent context command"
        />
        <p>
          The CLI setup also adds workflow instructions to your agent’s project
          instruction file. Manual MCP configuration only connects the tools.
          Context7 is optional; use it or official library documentation to
          verify current syntax.
        </p>
      </div>
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
