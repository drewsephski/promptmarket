import type { Metadata } from "next";
import { Bezel } from "../../components/bezel";
import { CommandBlock } from "../../components/command-block";
import { HOSTED_MCP_URL, pageMetadata } from "../../lib/present";

export const metadata: Metadata = pageMetadata(
  "Docs",
  "Read PromptMarket lessons, copy prompts, or load the same material from an MCP client.",
  "/docs",
);

const cursorConfig = `{
  "mcpServers": {
    "promptmarket": {
      "url": "${HOSTED_MCP_URL}"
    }
  }
}`;

export default function DocsPage() {
  return (
    <main className="docs">
      <div className="hero-copy">
        <p className="eyebrow">Docs</p>
        <h1>Use it from a browser, a CLI, or an agent.</h1>
        <p className="lede">
          Read it here, or load the same lessons, guides, and prompts from an
          agent.
        </p>
      </div>

      <Bezel coreClassName="panel">
        <h2>Learn and prompts</h2>
        <p>
          Start at <a href="/learn">Learn</a> for the patterns, open{" "}
          <a href="/guides">Guides</a> when you want to build an app from a
          blank project, then use <a href="/prompts">Prompts</a> and copy the
          one that matches the job. A prompt does not need to be installed.
          Placeholders such as <code>{"{{input}}"}</code> are marked on the
          page. PromptMarket does not call a model for you.
        </p>
      </Bezel>

      <Bezel coreClassName="panel">
        <h2>MCP</h2>
        <p>
          Point a client at the hosted endpoint. The tools search and return
          content. They do not rank with a model.
        </p>
        <CommandBlock command={HOSTED_MCP_URL} label="Copy MCP endpoint" />
        <p className="note">Cursor remote MCP config:</p>
        <CommandBlock command={cursorConfig} label="Copy Cursor MCP config" />
        <p className="note">
          Primary tools: <code>search_prompts</code>, <code>get_prompt</code>,{" "}
          <code>search_learn</code>, <code>get_learn_topic</code>,{" "}
          <code>search_guides</code>, <code>get_guide</code>, and{" "}
          <code>recommend_prompt</code>. <code>recommend_prompt</code> returns
          one match only when the wording is specific. Otherwise it returns
          alternatives.
        </p>
        <p className="note">
          Skill tools remain available: <code>search_recipes</code>,{" "}
          <code>inspect_recipe</code>, <code>get_recipe</code>, and{" "}
          <code>list_recipe_versions</code>.
        </p>
      </Bezel>

      <Bezel coreClassName="panel">
        <h2>CLI</h2>
        <CommandBlock
          command={`pnpm dlx @promptmarket/cli search "structured extraction"
pnpm dlx @promptmarket/cli show structured-data-extractor
pnpm dlx @promptmarket/cli learn rag
pnpm dlx @promptmarket/cli guides
pnpm dlx @promptmarket/cli guide ai-product-brief-builder`}
          label="Copy CLI examples"
        />
        <p className="note">
          <code>search</code> prints prompts first, then skills.{" "}
          <code>show</code> prints a prompt body, or a skill when the name is
          not a prompt. <code>learn</code> prints a short lesson and its URL.{" "}
          <code>guides</code> lists tutorials, and <code>guide</code> prints one
          guide's outline and URL.
        </p>
      </Bezel>

      <Bezel coreClassName="panel">
        <h2>Skills</h2>
        <p>
          A skill is a versioned procedure an agent can install, such as a pull
          request review. Browse them on <a href="/recipes">Skills</a>.
          Publishing still goes through a GitHub pull request, described on{" "}
          <a href="/contribute">Contribute</a>.
        </p>
        <CommandBlock
          command={`pnpm dlx @promptmarket/cli add github-pr-review
pnpm dlx @promptmarket/cli install`}
          label="Copy skill install commands"
        />
      </Bezel>
    </main>
  );
}
