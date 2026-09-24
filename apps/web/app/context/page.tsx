import {
  buildContext,
  buildPlan,
  formatAgentContext,
  loadContentCatalog,
} from "@promptmarket/content";
import type { Metadata } from "next";
import { ContextForm } from "../../components/context-form";
import { WorkflowResult } from "../../components/workflow-result";
import {
  contextSearchParams,
  projectFromFilters,
  type ContextFilters,
} from "../../lib/context-query";
import { pageMetadata, searchQuery } from "../../lib/present";
import { workflowView } from "../../lib/workflow";

interface ContextPageProps {
  searchParams: Promise<{
    q?: string | string[];
    framework?: string | string[];
    ai?: string | string[];
    provider?: string | string[];
    database?: string | string[];
    orm?: string | string[];
  }>;
}

function filtersFrom(
  params: Awaited<ContextPageProps["searchParams"]>,
): ContextFilters {
  return {
    framework: searchQuery(params.framework),
    ai: searchQuery(params.ai),
    provider: searchQuery(params.provider),
    database: searchQuery(params.database),
    orm: searchQuery(params.orm),
  };
}

export async function generateMetadata({
  searchParams,
}: ContextPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = searchQuery(params.q).trim();
  const filters = filtersFrom(params);
  return pageMetadata(
    query ? `Context · ${query}` : "Context",
    "Describe an AI feature. PromptMarket picks the pattern, plan, docs, and checks.",
    contextSearchParams(query, filters),
  );
}

export default async function ContextPage({ searchParams }: ContextPageProps) {
  const params = await searchParams;
  const query = searchQuery(params.q).trim();
  const filters = filtersFrom(params);
  const project = projectFromFilters(filters);
  const catalog = loadContentCatalog();
  const context = query
    ? buildContext(catalog, {
        query,
        project,
        detail: "compact",
        maxItems: 4,
      })
    : undefined;
  const plan = query ? buildPlan(catalog, { query, project }) : undefined;
  const topic = context?.topics[0];
  const matched = Boolean(plan && topic);
  const related = [
    ...(context?.related?.topics ?? []),
    ...(context?.related?.prompts ?? []),
  ].slice(0, 4);

  return (
    <main className="docs product">
      <div className="hero-copy">
        <p className="eyebrow">Context</p>
        <h1>What are you building?</h1>
      </div>

      <ContextForm query={query} filters={filters} />

      {matched && plan && context && topic ? (
        <WorkflowResult
          view={workflowView(plan, topic.definition, formatAgentContext(context))}
        />
      ) : null}

      {matched && related.length > 0 ? (
        <section className="related-quiet" aria-label="Related">
          {related.map(function renderRelated(item) {
            const href =
              item.kind === "guide"
                ? `/guides/${item.name}`
                : item.kind === "prompt"
                  ? `/prompts/${item.name}`
                  : `/learn/${item.name}`;
            return (
              <a key={`${item.kind}-${item.name}`} href={href}>
                {item.title}
              </a>
            );
          })}
        </section>
      ) : null}

      {query && context && !topic ? (
        <p className="empty">
          No pattern matched. Try RAG, tool calling, or structured output.
        </p>
      ) : null}
    </main>
  );
}
