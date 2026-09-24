import {
  CATEGORY_LABELS,
  PROMPT_CATEGORIES,
  loadContentCatalog,
} from "@promptmarket/content";
import type { Metadata } from "next";
import { isPromptCategory } from "../../lib/gallery";
import { searchPageMetadata, searchQuery, SITE_URL } from "../../lib/present";

import { StructuredData } from "../../components/structured-data";

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
  return searchPageMetadata(
    "AI Agent Prompts: Free Templates & Examples",
    "Copy AI agent prompts for tool calling, RAG, extraction, and support. Each template includes variables, example inputs and outputs, and common mistakes.",
    "/prompts",
    Boolean(first(params.q) || first(params.category)),
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
        const haystack =
          `${prompt.title} ${prompt.description} ${prompt.slug}`.toLowerCase();
        return haystack.includes(needle);
      })
    : prompts;

  return (
    <main className="docs product">
      <div className="hero-copy">
        <p className="eyebrow">Prompts</p>
        <h1>AI agent prompts and templates</h1>
        <p className="lede">
          Free, reusable prompts for AI agents and the model calls they rely on.
          Choose a template for tool calling, RAG, extraction, or support, then
          adapt its variables and test the example in your app.
        </p>
      </div>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "AI agent prompts and templates",
          url: `${SITE_URL}/prompts`,
          mainEntity: {
            "@type": "ItemList",
            itemListElement: results.map((prompt, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: prompt.title,
              url: `${SITE_URL}${prompt.href}`,
            })),
          },
        }}
      />
      <p>
        New to agent instructions? Start with{" "}
        <a href="/learn/agent-prompts">how to write an AI agent prompt</a>. For
        installable coding procedures, browse{" "}
        <a href="/recipes">agent skills</a>.
      </p>
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
        <a
          href={chipHref("", q)}
          aria-current={selectedCategory ? undefined : "page"}
        >
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
      {!q && !selectedCategory ? (
        <section className="band" aria-labelledby="choose-prompt">
          <h2 id="choose-prompt">Choose a prompt for the job</h2>
          <p>
            An agent prompt describes a task, the context to use, available
            tools, and when to stop. A prompt guides the model; your application
            must still enforce permissions, validate tool arguments, and limit
            retries.
          </p>
          <ul className="related">
            <li>
              <a href="/prompts/agent-system-prompt">
                AI agent system prompt template
              </a>
              <span>
                Define the objective, tool boundaries, stopping conditions, and
                final report.
              </span>
            </li>
            <li>
              <a href="/prompts/safe-tool-calling-system">
                Tool-calling system prompt
              </a>
              <span>
                Request only known tools and report actions from actual tool
                results.
              </span>
            </li>
            <li>
              <a href="/prompts/rag-grounded-answer">RAG prompt template</a>
              <span>
                Answer from retrieved sources and handle missing evidence.
              </span>
            </li>
            <li>
              <a href="/prompts/customer-support-answer">
                Customer support prompt
              </a>
              <span>Draft a response using the supplied product context.</span>
            </li>
          </ul>
          <h2>How to use these templates</h2>
          <ol>
            <li>
              Open a template and check its intended use and example output.
            </li>
            <li>
              Replace every variable with your actual tools, context, or schema.
            </li>
            <li>
              Keep stable instructions separate from untrusted user input and
              retrieved content.
            </li>
            <li>
              Test a successful task, missing information, and a failed tool
              call before shipping.
            </li>
          </ol>
          <p>
            Use the <a href="/learn/evals">evaluation guide</a> to compare
            revisions against the same cases.
          </p>
          <h2>What is the difference between a prompt and a skill?</h2>
          <p>
            A prompt supplies instructions for a model call. A skill packages a
            repeatable procedure for a coding agent, including steps and checks.
            Browse <a href="/recipes">coding agent skills</a> for
            installation-ready procedures, or{" "}
            <a href="/guides">implementation guides</a> to build a complete
            feature.
          </p>
        </section>
      ) : null}
    </main>
  );
}
