import {
  InvalidRecipeVersionError,
  RecipeNotFoundError,
  RecipeVersionNotFoundError,
} from "@promptmarket/registry";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SemVerSchema } from "@promptmarket/schema";
import { Bezel } from "../../../components/bezel";
import { CommandBlock } from "../../../components/command-block";
import { SkillBody } from "../../../components/skill-body";
import { catalogRegistry } from "../../../lib/catalog";
import {
  HOSTED_MCP_URL,
  exactInstallCommand,
  latestInstallCommand,
  recipeHref,
  versionQuery,
} from "../../../lib/present";

interface RecipePageProps {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ version?: string | string[] }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: RecipePageProps): Promise<Metadata> {
  const { name } = await params;
  const requested = versionQuery((await searchParams).version);
  if (requested && !SemVerSchema.safeParse(requested).success) {
    return { title: name };
  }
  try {
    const recipe = await catalogRegistry().get(name, requested);
    return {
      title: recipe.manifest.name,
      description: recipe.skill.description,
    };
  } catch {
    return { title: "Recipe" };
  }
}

export default async function RecipePage({
  params,
  searchParams,
}: RecipePageProps) {
  const { name } = await params;
  const requested = versionQuery((await searchParams).version);
  if (requested && !SemVerSchema.safeParse(requested).success) {
    return (
      <main className="docs">
        <a className="back" href={`/recipes/${name}`}>
          View latest
        </a>
        <h1>{name}</h1>
        <p className="error">Invalid version: {requested}</p>
      </main>
    );
  }

  try {
    const registry = catalogRegistry();
    const history = await registry.listVersions(name);
    const selected = requested ?? history.latest;
    const pkg = await registry.fetchPackage(name, selected);
    const recipe = pkg.recipe;
    const mcp = recipe.manifest.requires.mcp;

    return (
      <main>
        <header className="recipe-head">
          <a className="back rise" href="/">
            All recipes
          </a>
          <h1 className="rise" style={{ animationDelay: "80ms" }}>
            {recipe.manifest.name}
          </h1>
          <p className="lede rise" style={{ animationDelay: "150ms" }}>
            {recipe.skill.description}
          </p>
          <p className="meta rise" style={{ animationDelay: "200ms" }}>
            Latest {history.latest}. Showing {recipe.manifest.version}.
          </p>
          <div className="versions rise" aria-label="Versions" style={{ animationDelay: "240ms" }}>
            {history.versions.map(function renderVersion(item) {
              const current = item.version === recipe.manifest.version;
              return (
                <a
                  key={item.version}
                  href={recipeHref(recipe.manifest.name, item.version)}
                  aria-current={current ? "page" : undefined}
                >
                  {item.version}
                </a>
              );
            })}
          </div>
        </header>

        <div className="layout">
          <div className="stack">
            <Bezel coreClassName="panel">
              <h2>Install</h2>
              <p className="note">Latest</p>
              <CommandBlock
                command={latestInstallCommand(recipe.manifest.name)}
                label="Copy latest install command"
              />
              <p className="note">Exact version</p>
              <CommandBlock
                command={exactInstallCommand(
                  recipe.manifest.name,
                  recipe.manifest.version,
                )}
                label="Copy exact install command"
              />
              <p className="note">
                Agents can also load this recipe from {HOSTED_MCP_URL} with{" "}
                <code>get_recipe</code>.
              </p>
            </Bezel>
            <Bezel coreClassName="panel">
              <h2>What the recipe instructs</h2>
              <p className="note">
                This is the SKILL.md procedure an agent follows after it loads
                the recipe.
              </p>
              <SkillBody markdown={recipe.skill.body} />
            </Bezel>
          </div>
          <aside className="facts">
            <Bezel coreClassName="panel">
              <h3>Author</h3>
              {recipe.manifest.author.url ? (
                <p>
                  <a href={recipe.manifest.author.url}>
                    {recipe.manifest.author.name}
                  </a>
                </p>
              ) : (
                <p>{recipe.manifest.author.name}</p>
              )}
            </Bezel>
            <Bezel coreClassName="panel">
              <h3>Tags</h3>
              <div className="tags">
                {recipe.manifest.tags.map(function renderTag(tag) {
                  return (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  );
                })}
              </div>
            </Bezel>
            <Bezel coreClassName="panel">
              <h3>Compatibility</h3>
              <div className="compat">
                {recipe.manifest.compatibility.map(function renderAgent(agent) {
                  return <span key={agent}>{agent}</span>;
                })}
              </div>
            </Bezel>
            <Bezel coreClassName="panel">
              <h3>Declared capabilities</h3>
              <p className="note">
                What the recipe says it may use. This is separate from the
                instructions above.
              </p>
              <p>Filesystem: {recipe.manifest.capabilities.filesystem}</p>
              <p>Shell: {recipe.manifest.capabilities.shell ? "yes" : "no"}</p>
              <p>
                Network:{" "}
                {recipe.manifest.capabilities.network.length > 0
                  ? recipe.manifest.capabilities.network.join(", ")
                  : "none"}
              </p>
            </Bezel>
            <Bezel coreClassName="panel">
              <h3>Required MCP servers</h3>
              <p className="note">
                External MCP servers the recipe expects to be available.
              </p>
              {mcp.length === 0 ? (
                <p>None.</p>
              ) : (
                <ul>
                  {mcp.map(function renderServer(server) {
                    return <li key={server}>{server}</li>;
                  })}
                </ul>
              )}
            </Bezel>
            <Bezel coreClassName="panel">
              <h3>Integrity</h3>
              <p className="version">{pkg.integrity}</p>
            </Bezel>
          </aside>
        </div>
      </main>
    );
  } catch (error) {
    if (
      error instanceof RecipeNotFoundError ||
      error instanceof RecipeVersionNotFoundError ||
      error instanceof InvalidRecipeVersionError
    ) {
      notFound();
    }
    throw error;
  }
}
