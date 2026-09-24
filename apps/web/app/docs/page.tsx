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
        <h2 id="cursor">Cursor</h2>
        <p>
          One command adds the hosted MCP server and an Apply Intelligently
          project rule. Cursor then consults PromptMarket before implementing
          an AI feature.
        </p>
        <CommandBlock
          command={`pnpm dlx @promptmarket/cli setup cursor
pnpm dlx @promptmarket/cli setup cursor --write
pnpm dlx @promptmarket/cli setup cursor --write --with-context7
pnpm dlx @promptmarket/cli setup cursor --check`}
          label="Copy Cursor setup"
        />
        <p className="note">
          <code>--write</code> merges <code>promptmarket</code> into{" "}
          <code>.cursor/mcp.json</code> and writes{" "}
          <code>.cursor/rules/promptmarket.mdc</code>. Other MCP servers stay
          in place. <code>--dry-run</code> is the default.{" "}
          <code>--remove</code> deletes only the PromptMarket entries.{" "}
          <code>--with-context7</code> detects an existing Context7 server and,
          if one is missing, hands off to <code>npx ctx7 setup --cursor --project</code>.
          PromptMarket does not copy or store that API key.
        </p>
      </Bezel>

      <Bezel coreClassName="panel">
        <h2>MCP</h2>
        <p>
          Point a client at the hosted endpoint. The tools search and return
          content. They do not rank with a model. You can also resolve a
          feature in the browser at <a href="/context">Context</a>.
        </p>
        <CommandBlock command={HOSTED_MCP_URL} label="Copy MCP endpoint" />
        <p className="note">Cursor remote MCP config:</p>
        <CommandBlock command={cursorConfig} label="Copy Cursor MCP config" />
        <p className="note">
          Primary tools: <code>get_workflow</code>, <code>build_context</code>,{" "}
          <code>build_plan</code>,{" "}
          <code>search_prompts</code>
          , <code>get_prompt</code>, <code>search_learn</code>,{" "}
          <code>get_learn_topic</code>, <code>search_guides</code>,{" "}
          <code>get_guide</code>, and <code>recommend_prompt</code>.{" "}
          <code>build_context</code> assembles the lesson, prompt, guide, and
          skill for a feature in one call. <code>recommend_prompt</code> returns
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
          command={`pnpm dlx @promptmarket/cli detect
pnpm dlx @promptmarket/cli doctor
pnpm dlx @promptmarket/cli context "add RAG over our documentation" --project . --format agent
pnpm dlx @promptmarket/cli plan "add RAG over our documentation" --project .
pnpm dlx @promptmarket/cli search "structured extraction"
pnpm dlx @promptmarket/cli show structured-data-extractor
pnpm dlx @promptmarket/cli learn rag
pnpm dlx @promptmarket/cli guides
pnpm dlx @promptmarket/cli guide ai-product-brief-builder`}
          label="Copy CLI examples"
        />
        <p className="note">
          <code>detect</code> fingerprints the current project from{" "}
          <code>package.json</code> and config filenames. <code>doctor</code>{" "}
          compares those versions with the packages each guide was reproduced
          with. <code>context</code>{" "}
          assembles the lesson, prompt, and guide for a feature, and{" "}
          <code>--project</code> reranks that result toward the detected stack
          without overriding a more specific query. <code>--format agent</code>{" "}
          prints that context as markdown for an agent. <code>search</code> prints
          guides, lessons, prompts, and skills. <code>show</code> prints a
          prompt body, or a skill when the name is not a prompt.{" "}
          <code>learn</code> prints a short lesson and its URL.{" "}
          <code>guides</code> lists tutorials, and <code>guide</code> prints one
          guide's outline and URL.           Commands read the hosted catalog at{" "}
          <code>/api/content/v1</code>. A cache younger than 15 minutes is used
          immediately; <code>--refresh</code> checks again. If the network
          fails, the CLI uses the cache, then the bundled snapshot.{" "}
          <code>--offline</code> uses the snapshot directly.{" "}
          <code>build_context</code> accepts the same project fingerprint when
          an agent already knows the stack.
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
