import type { RecipeSummary } from "@promptmarket/registry";
import { Bezel } from "../components/bezel";
import { CommandBlock } from "../components/command-block";
import { ArrowMark } from "../components/marks";
import { catalogRegistry } from "../lib/catalog";
import {
  HOSTED_MCP_URL,
  latestInstallCommand,
  searchQuery,
} from "../lib/present";

interface HomeProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const query = searchQuery((await searchParams).q).trim();
  let recipes: RecipeSummary[] = [];
  let error: string | null = null;
  try {
    const registry = catalogRegistry();
    recipes = query ? await registry.search(query) : await registry.list();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load recipes";
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow rise" style={{ animationDelay: "40ms" }}>
            Registry for agent skills
          </p>
          <h1 className="rise" style={{ animationDelay: "120ms" }}>
            Tested agent recipes for AI coding agents.
          </h1>
          <p className="lede rise" style={{ animationDelay: "200ms" }}>
            Discover a recipe, inspect what it will do, then install it into{" "}
            <code>.agents/skills</code> or load it through the hosted MCP
            server.
          </p>
        </div>
        <div className="channels">
          <div className="rise" style={{ animationDelay: "280ms" }}>
            <Bezel coreClassName="channel">
              <h2>Install with the CLI</h2>
              <CommandBlock
                command={latestInstallCommand("github-pr-review")}
                label="Copy install command"
              />
            </Bezel>
          </div>
          <div className="rise channel-offset" style={{ animationDelay: "360ms" }}>
            <Bezel coreClassName="channel">
              <h2>Hosted MCP</h2>
              <CommandBlock command={HOSTED_MCP_URL} label="Copy MCP endpoint" />
            </Bezel>
          </div>
        </div>
      </section>

      <section className="chapter" aria-labelledby="catalog-heading">
        <div className="chapter-head">
          <p className="eyebrow">Catalog</p>
          <h2 id="catalog-heading">Recipes</h2>
        </div>
        <form className="search" action="/" method="get" role="search">
          <label htmlFor="recipe-search">Search the registry</label>
          <Bezel coreClassName="search-core">
            <input
              id="recipe-search"
              name="q"
              defaultValue={query}
              placeholder="release readiness, database, pull request"
              autoComplete="off"
            />
            <button type="submit" className="pill">
              <span>Search</span>
              <span className="pill-mark" aria-hidden="true">
                <ArrowMark />
              </span>
            </button>
          </Bezel>
        </form>
        {query ? (
          <p className="note">
            Results for “{query}”. <a href="/">Clear</a>
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {!error && recipes.length === 0 ? (
          <p className="empty">No recipes matched.</p>
        ) : null}
        <div className="catalog">
          {recipes.map(function renderRecipe(recipe, index) {
            return (
              <a
                className="entry rise"
                key={recipe.name}
                href={`/recipes/${recipe.name}`}
                style={{ animationDelay: `${80 + index * 60}ms` }}
              >
                <Bezel coreClassName="entry-core">
                  <span className="entry-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="entry-body">
                    <h3>{recipe.name}</h3>
                    <p>{recipe.description}</p>
                    <div className="entry-meta">
                      <span className="version">{recipe.version}</span>
                      <div className="tags">
                        {recipe.tags.map(function renderTag(tag) {
                          return (
                            <span className="tag" key={tag}>
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                      <div className="compat" aria-label="Compatibility">
                        {recipe.compatibility.map(function renderAgent(agent) {
                          return <span key={agent}>{agent}</span>;
                        })}
                      </div>
                    </div>
                  </div>
                  <span className="pill-mark entry-arrow" aria-hidden="true">
                    <ArrowMark />
                  </span>
                </Bezel>
              </a>
            );
          })}
        </div>
      </section>

      <section className="chapter" aria-labelledby="how-heading">
        <div className="chapter-head">
          <p className="eyebrow">Method</p>
          <h2 id="how-heading">Discover, inspect, then install.</h2>
        </div>
        <div className="steps">
          <article className="rise" style={{ animationDelay: "40ms" }}>
            <Bezel coreClassName="step">
              <span className="numeral">01</span>
              <strong>Discover</strong>
              <p className="note">
                Search the catalog here, or with <code>promptmarket search</code>.
              </p>
            </Bezel>
          </article>
          <article className="rise" style={{ animationDelay: "120ms" }}>
            <Bezel className="step-shift" coreClassName="step">
              <span className="numeral">02</span>
              <strong>Inspect</strong>
              <p className="note">
                Read the procedure, the capabilities it declares, and any MCP server
                it expects.
              </p>
            </Bezel>
          </article>
          <article className="rise" style={{ animationDelay: "200ms" }}>
            <Bezel coreClassName="step">
              <span className="numeral">03</span>
              <strong>Install or use</strong>
              <p className="note">
                <code>promptmarket add</code> pins a version in{" "}
                <code>promptmarket.lock</code>. An MCP client can load the same
                recipe without installing it.
              </p>
            </Bezel>
          </article>
        </div>
      </section>
    </main>
  );
}
