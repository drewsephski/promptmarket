import {
  CATEGORY_LABELS,
  PROMPT_CATEGORIES,
  loadContentCatalog,
} from "@promptmarket/content";
import type { Metadata } from "next";
import { Bezel } from "../../components/bezel";
import { ArrowMark } from "../../components/marks";
import { catalogRegistry } from "../../lib/catalog";
import {
  filterGallery,
  isPromptCategory,
  promptGalleryItem,
  skillGalleryItem,
  type GalleryItem,
} from "../../lib/gallery";
import { pageMetadata, searchQuery } from "../../lib/present";

interface PromptsPageProps {
  searchParams: Promise<{
    q?: string | string[];
    category?: string | string[];
    kind?: string | string[];
    difficulty?: string | string[];
  }>;
}

function first(value: string | string[] | undefined): string {
  return searchQuery(value).trim();
}

export async function generateMetadata({
  searchParams,
}: PromptsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = new URLSearchParams();
  const q = first(params.q);
  const category = first(params.category);
  const kind = first(params.kind);
  const difficulty = first(params.difficulty);
  if (q) query.set("q", q);
  if (category) query.set("category", category);
  if (kind) query.set("kind", kind);
  if (difficulty) query.set("difficulty", difficulty);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return pageMetadata(
    "Prompts",
    "Reusable prompt patterns for extraction, RAG, tools, support, and evals.",
    `/prompts${suffix}`,
  );
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const params = await searchParams;
  const q = first(params.q);
  const category = first(params.category);
  const kind = first(params.kind);
  const difficulty = first(params.difficulty);
  const selectedCategory = isPromptCategory(category) ? category : "";
  const catalog = loadContentCatalog();
  const recipes = await catalogRegistry().list();
  const items = [
    ...catalog.prompts.map(promptGalleryItem),
    ...recipes.map(skillGalleryItem),
  ];
  const results = filterGallery(items, {
    query: q,
    category: selectedCategory,
    kind,
    difficulty,
  });

  return (
    <main className="docs">
      <div className="hero-copy">
        <p className="eyebrow">Gallery</p>
        <h1>Prompts for real AI features.</h1>
        <p className="lede">
          Copy a pattern into your app. Skills are installable procedures for
          coding agents, kept separate from prompts.
        </p>
      </div>
      <form className="filters" action="/prompts" method="get" role="search">
        <label className="filter-field">
          <span>Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="structured output, RAG, triage"
          />
        </label>
        <label className="filter-field">
          <span>Category</span>
          <select name="category" defaultValue={selectedCategory}>
            <option value="">All</option>
            {PROMPT_CATEGORIES.map(function renderCategory(item) {
              return (
                <option key={item} value={item}>
                  {CATEGORY_LABELS[item]}
                </option>
              );
            })}
          </select>
        </label>
        <label className="filter-field">
          <span>Type</span>
          <select
            name="kind"
            defaultValue={kind === "skill" || kind === "prompt" ? kind : ""}
          >
            <option value="">Prompts and skills</option>
            <option value="prompt">Prompts</option>
            <option value="skill">Skills</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Difficulty</span>
          <select
            name="difficulty"
            defaultValue={
              difficulty === "beginner" ||
              difficulty === "intermediate" ||
              difficulty === "advanced"
                ? difficulty
                : ""
            }
          >
            <option value="">Any</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <button className="pill" type="submit">
          <span>Apply</span>
          <span className="pill-mark" aria-hidden="true">
            <ArrowMark />
          </span>
        </button>
      </form>
      {results.length === 0 ? (
        <p className="empty">
          Nothing matched. Try a broader search, or clear a filter.
        </p>
      ) : (
        <div className="catalog">
          {results.map(function renderItem(item) {
            return (
              <GalleryCard item={item} key={`${item.kind}-${item.slug}`} />
            );
          })}
        </div>
      )}
    </main>
  );
}

function GalleryCard({ item }: { item: GalleryItem }) {
  return (
    <a className="entry" href={item.href}>
      <Bezel coreClassName="entry-core">
        <div className="entry-body">
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <div className="entry-meta">
            <span className="tag">
              {item.kind === "skill" ? "Skill" : "Prompt"}
            </span>
            <span className="tag">{item.categoryLabel}</span>
            {item.difficulty ? (
              <span className="tag">{item.difficulty}</span>
            ) : null}
          </div>
        </div>
        <span className="pill-mark entry-arrow" aria-hidden="true">
          <ArrowMark />
        </span>
      </Bezel>
    </a>
  );
}
