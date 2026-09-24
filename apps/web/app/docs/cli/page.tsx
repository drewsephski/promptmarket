import type { Metadata } from "next";
import { CommandBlock } from "../../../components/command-block";
import { pageMetadata } from "../../../lib/present";

export const metadata: Metadata = pageMetadata(
  "CLI",
  "PromptMarket CLI commands for context, plans, features, and content.",
  "/docs/cli",
);

const commands = `pnpm dlx @promptmarket/cli detect
pnpm dlx @promptmarket/cli doctor
pnpm dlx @promptmarket/cli context "add RAG over our documentation" --project . --format agent
pnpm dlx @promptmarket/cli plan "add RAG over our documentation" --project .
pnpm dlx @promptmarket/cli feature init "add RAG over our documentation" --project . --write --path "app/api/chat/**"
pnpm dlx @promptmarket/cli feature attach rag-internal-docs --path "lib/rag/**" --write
pnpm dlx @promptmarket/cli impacted --base origin/main
pnpm dlx @promptmarket/cli feature review --base origin/main
pnpm dlx @promptmarket/cli verify changed --base origin/main
pnpm dlx @promptmarket/cli feature status
pnpm dlx @promptmarket/cli search "structured extraction"
pnpm dlx @promptmarket/cli show structured-data-extractor
pnpm dlx @promptmarket/cli learn rag
pnpm dlx @promptmarket/cli guides
pnpm dlx @promptmarket/cli guide ai-product-brief-builder
pnpm dlx @promptmarket/cli setup cursor --write --with-context7
pnpm dlx @promptmarket/cli add github-pr-review`;

export default function CliDocsPage() {
  return (
    <main className="docs product">
      <div className="hero-copy">
        <p className="eyebrow">Docs</p>
        <h1>CLI</h1>
        <p className="lede">
          <a href="/docs">Back to setup</a>
        </p>
      </div>
      <CommandBlock command={commands} label="Copy CLI examples" />
      <div className="docs-prose">
        <p>
          <code>feature init --write</code> stores a version-controlled contract
          for one AI feature. <code>--path</code> records the files that feature
          owns. <code>feature attach</code> adds paths to an existing contract.{" "}
          <code>feature adopt</code> records a feature that already exists and
          does not edit its implementation.
        </p>
        <p>
          <code>impacted --base</code> lists features affected since that git
          ref. <code>feature review --base</code> lists contract checks for
          those features. <code>verify changed --base</code> runs only their
          Promptfoo suites. <code>feature status</code> checks a contract.
        </p>
        <p>
          <code>detect</code> fingerprints the current project.{" "}
          <code>doctor</code> compares those versions with the packages each
          guide was reproduced with. <code>context</code> assembles the lesson,
          prompt, and guide. <code>--format agent</code> prints that context as
          markdown. <code>plan</code> prints the implementation plan.
        </p>
        <p>
          <code>search</code> prints guides, lessons, prompts, and skills.{" "}
          <code>show</code> prints a prompt body. <code>learn</code> prints a
          short lesson. <code>guides</code> lists tutorials, and{" "}
          <code>guide</code> prints one outline. Commands read the hosted
          catalog at <code>/api/content/v1</code>. A cache younger than 15
          minutes is used immediately. <code>--refresh</code> checks again.{" "}
          <code>--offline</code> uses the bundled snapshot.
        </p>
        <p>
          <code>setup cursor --write</code> merges the hosted MCP server into{" "}
          <code>.cursor/mcp.json</code> and writes a project rule.{" "}
          <code>--with-context7</code> detects an existing Context7 server and,
          if one is missing, hands off to{" "}
          <code>npx ctx7 setup --cursor --project</code>. PromptMarket does not
          copy or store that API key.
        </p>
      </div>
    </main>
  );
}
