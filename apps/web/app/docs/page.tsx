import type { Metadata } from "next";
import { Bezel } from "../../components/bezel";
import { CommandBlock } from "../../components/command-block";
import { HOSTED_MCP_URL } from "../../lib/present";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Install PromptMarket recipes with the CLI or load them through MCP.",
};

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
        <p className="eyebrow rise">Usage</p>
        <h1 className="rise" style={{ animationDelay: "80ms" }}>
          CLI and MCP
        </h1>
        <p className="lede rise" style={{ animationDelay: "160ms" }}>
          PromptMarket resolves the latest recipe unless you pin a version.{" "}
          <code>promptmarket install</code> reinstalls the exact versions and
          integrity hashes recorded in <code>promptmarket.lock</code>.
        </p>
      </div>

      <div className="rise" style={{ animationDelay: "220ms" }}>
        <Bezel coreClassName="panel">
          <h2>CLI</h2>
          <CommandBlock
            command={`pnpm dlx @promptmarket/cli search "pull request"
pnpm dlx @promptmarket/cli info github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review
pnpm dlx @promptmarket/cli add github-pr-review@0.1.0
pnpm dlx @promptmarket/cli install`}
            label="Copy CLI examples"
          />
          <p className="note">
            <code>add</code> writes the recipe to <code>.agents/skills/</code>{" "}
            and records name, version, source, and integrity.{" "}
            <code>install</code> reads that lockfile and does not move you to a
            newer version.
          </p>
        </Bezel>
      </div>

      <div className="rise" style={{ animationDelay: "300ms" }}>
        <Bezel coreClassName="panel">
          <h2>MCP</h2>
          <p>
            Compatible agents can search, inspect, list versions, and load
            PromptMarket recipes from the hosted endpoint.
          </p>
          <CommandBlock command={HOSTED_MCP_URL} label="Copy MCP endpoint" />
          <p className="note">
            Cursor can call that endpoint with a remote MCP server entry:
          </p>
          <CommandBlock command={cursorConfig} label="Copy Cursor MCP config" />
          <p className="note">
            Tools: <code>search_recipes</code>, <code>inspect_recipe</code>,{" "}
            <code>list_recipe_versions</code>, and <code>get_recipe</code>. Pass{" "}
            <code>version</code> to inspect or load an exact release. Search
            results stay summaries and do not include SKILL.md bodies.
          </p>
        </Bezel>
      </div>

      <div className="rise" style={{ animationDelay: "380ms" }}>
        <Bezel coreClassName="panel">
          <h2>Author</h2>
          <p>
            Create a recipe locally, validate it, and open a GitHub pull
            request. The steps are on <a href="/contribute">Contribute</a>.
          </p>
          <CommandBlock
            command={`pnpm dlx @promptmarket/cli init my-recipe
pnpm dlx @promptmarket/cli check ./my-recipe
pnpm dlx @promptmarket/cli pack ./my-recipe
pnpm dlx @promptmarket/cli submit ./my-recipe`}
            label="Copy author commands"
          />
        </Bezel>
      </div>
    </main>
  );
}
