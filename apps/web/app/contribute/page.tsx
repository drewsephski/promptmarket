import type { Metadata } from "next";
import { Bezel } from "../../components/bezel";
import { CommandBlock } from "../../components/command-block";

export const metadata: Metadata = {
  title: "Contribute",
  description: "Publish a PromptMarket recipe through a GitHub pull request.",
};

const author = `pnpm dlx @promptmarket/cli init my-recipe
cd my-recipe

# edit SKILL.md
pnpm dlx @promptmarket/cli check .
pnpm dlx @promptmarket/cli pack .
pnpm dlx @promptmarket/cli submit .`;

export default function ContributePage() {
  return (
    <main className="docs">
      <div className="hero-copy">
        <p className="eyebrow rise">Contribute</p>
        <h1 className="rise" style={{ animationDelay: "80ms" }}>
          A pull request is the publish step
        </h1>
        <p className="lede rise" style={{ animationDelay: "160ms" }}>
          A new recipe lands when a pull request merges.
        </p>
      </div>

      <div className="rise" style={{ animationDelay: "220ms" }}>
        <Bezel coreClassName="panel">
          <h2>Path</h2>
          <ol className="contribute-steps">
            <li>
              Create the recipe with the CLI or at <a href="/create">/create</a>
              .
            </li>
            <li>
              Validate the package with <code>promptmarket check</code>.
            </li>
            <li>
              Submit it. The CLI forks the repository, commits only the new
              version directory, and opens a pull request.
            </li>
            <li>
              CI checks the registry and rejects edits to versions already on
              main.
            </li>
            <li>
              Review, merge, and the hosted registry serves that immutable
              version.
            </li>
          </ol>
        </Bezel>
      </div>

      <div className="rise" style={{ animationDelay: "300ms" }}>
        <Bezel coreClassName="panel">
          <h2>CLI</h2>
          <CommandBlock command={author} label="Copy author commands" />
          <p className="note">
            <code>submit</code> uses the GitHub CLI. Install <code>gh</code> and
            run <code>gh auth login</code> first. <code>submit --dry-run</code>{" "}
            validates the recipe and checks that the version is not already
            published.
          </p>
        </Bezel>
      </div>

      <div className="rise" style={{ animationDelay: "380ms" }}>
        <Bezel coreClassName="panel">
          <h2>Rules</h2>
          <p>
            Put the package at{" "}
            <code>recipes/&lt;name&gt;/&lt;version&gt;/</code>. Once a version
            is on <code>main</code>, later pull requests cannot change or delete
            it. Add another version directory instead.
          </p>
          <p className="note">
            Contribution rules:{" "}
            <a href="https://github.com/drewsephski/promptmarket/blob/main/CONTRIBUTING.md">
              CONTRIBUTING.md
            </a>
            .
          </p>
        </Bezel>
      </div>
    </main>
  );
}
