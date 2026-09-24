import {
  CATEGORY_LABELS,
  PROMPT_CATEGORIES,
  loadContentCatalog,
} from "@promptmarket/content";
import type { Metadata } from "next";
import { isPromptCategory } from "../../lib/gallery";
import { pageMetadata, searchQuery } from "../../lib/present";

interface PromptsPageProps {
  searchParams: Promise<{
    q?: string | string[];
    category?: string | string[];
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
  if (q) query.set("q", q);
  if (category) query.set("category", category);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return pageMetadata(
    "Prompts",
    "Reusable prompt patterns for extraction, RAG, tools, support, and evals.",
    `/prompts${suffix}`,
  );
}

function chipHref(category: string, q: string): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  const text = params.toString();
  return text ? `/prompts?${text}` : "/prompts";
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const params = await searchParams;
  const q = first(params.q);
  const category = first(params.category);
  const selectedCategory = isPromptCategory(category) ? category : "";
  const catalog = loadContentCatalog();
  const prompts = catalog.prompts.filter(function byCategory(prompt) {
    if (!selectedCategory) return true;
    return prompt.category === selectedCategory;
  });
  const needle = q.toLowerCase();
  const results = needle
    ? prompts.filter(function byQuery(prompt) {
        const haystack = `${prompt.title} ${prompt.description} ${prompt.slug}`.toLowerCase();
        return haystack.includes(needle);
      })
    : prompts;

  return (
    <main className="docs product">
      <div className="hero-copy">
        <p className="eyebrow">Prompts</p>
        <h1>Prompt patterns</h1>
        <p className="lede">
          Copy a pattern into your app. Agent procedures live on{" "}
          <a href="/recipes">Skills</a>.
        </p>
      </div>
      <form className="prompt-search" action="/prompts" method="get">
        {selectedCategory ? (
          <input type="hidden" name="category" value={selectedCategory} />
        ) : null}
        <label>
          <span className="sr-only">Search prompts</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search prompts..."
            aria-label="Search prompts"
          />
        </label>
      </form>
      <nav className="chip-row" aria-label="Categories">
        <a href={chipHref("", q)} aria-current={selectedCategory ? undefined : "page"}>
          All
        </a>
        {PROMPT_CATEGORIES.filter(function skipCoding(item) {
          return item !== "coding";
        }).map(function renderCategory(item) {
          return (
            <a
              key={item}
              href={chipHref(item, q)}
              aria-current={selectedCategory === item ? "page" : undefined}
            >
              {CATEGORY_LABELS[item]}
            </a>
          );
        })}
      </nav>
      {results.length === 0 ? (
        <p className="empty">Nothing matched. Try a broader search.</p>
      ) : (
        <div className="prompt-list">
          {results.map(function renderPrompt(prompt) {
            return (
              <a className="prompt-card" href={prompt.href} key={prompt.slug}>
                <h2>{prompt.title}</h2>
                <p>{prompt.description}</p>
                <span>
                  {CATEGORY_LABELS[prompt.category]}
                  {prompt.difficulty ? ` · ${prompt.difficulty}` : ""}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}
