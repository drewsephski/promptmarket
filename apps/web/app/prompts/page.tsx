import {
  CATEGORY_LABELS,
  PROMPT_CATEGORIES,
  loadContentCatalog,
} from "@promptmarket/content";
import type { Metadata } from "next";
import { Bezel } from "../../components/bezel";
import { PromptFilters } from "../../components/filter-select";
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
          Patterns you can copy. Skills are separate, for coding agents.
        </p>
      </div>
      <PromptFilters
        query={q}
        category={selectedCategory}
        kind={kind === "skill" || kind === "prompt" ? kind : ""}
        difficulty={
          difficulty === "beginner" ||
          difficulty === "intermediate" ||
          difficulty === "advanced"
            ? difficulty
            : ""
        }
        categories={PROMPT_CATEGORIES.map(function renderCategory(item) {
          return { value: item, label: CATEGORY_LABELS[item] };
        })}
      />
      {results.length === 0 ? (
        <p className="empty">
          Nothing matched. Try a broader search, or clear a filter.
        </p>
      ) : (
        <div className="catalog catalog-grid">
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
