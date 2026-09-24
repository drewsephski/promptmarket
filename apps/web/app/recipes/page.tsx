import type { RecipeSummary } from "@promptmarket/registry";
import type { Metadata } from "next";
import { Bezel } from "../../components/bezel";
import { ArrowMark } from "../../components/marks";
import { catalogRegistry } from "../../lib/catalog";
import { searchPageMetadata, searchQuery } from "../../lib/present";

interface RecipesPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export async function generateMetadata({
  searchParams,
}: RecipesPageProps): Promise<Metadata> {
  return searchPageMetadata(
    "AI Agent Skills for Coding Workflows",
    "Browse installable coding agent skills for pull request reviews, database migrations, and release checks. Inspect instructions and install with the CLI.",
    "/recipes",
    Boolean(searchQuery((await searchParams).q).trim()),
  );
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const query = searchQuery((await searchParams).q).trim();
  let recipes: RecipeSummary[] = [];
  let error: string | null = null;
  try {
    const registry = catalogRegistry();
    recipes = query ? await registry.search(query) : await registry.list();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load skills";
  }

  return (
    <main className="docs">
      <div className="hero-copy">
        <p className="eyebrow">Skills</p>
        <h1>AI agent skills for coding workflows</h1>
        <p className="lede">
          Install procedures into your agent. Reusable prompt patterns live in
          the <a href="/prompts">gallery</a>.
        </p>
      </div>
      <form className="search" action="/recipes" method="get" role="search">
        <label htmlFor="skill-search">Search skills</label>
        <Bezel coreClassName="search-core">
          <input
            id="skill-search"
            name="q"
            defaultValue={query}
            placeholder="pull request, database, onboarding"
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
      {error ? <p className="error">{error}</p> : null}
      {!error && recipes.length === 0 ? (
        <p className="empty">No skills matched.</p>
      ) : null}
      <div className="catalog">
        {recipes.map(function renderRecipe(recipe) {
          return (
            <a
              className="entry"
              href={`/recipes/${recipe.name}`}
              key={recipe.name}
            >
              <Bezel coreClassName="entry-core">
                <div className="entry-body">
                  <h3>{recipe.name}</h3>
                  <p>{recipe.description}</p>
                  <div className="entry-meta">
                    <span className="version">{recipe.version}</span>
                    <span className="tag">Skill</span>
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
    </main>
  );
}
