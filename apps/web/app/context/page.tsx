import {
  buildContext,
  buildPlan,
  formatAgentContext,
  formatContextText,
  formatPlan,
  loadContentCatalog,
} from "@promptmarket/content";
import type { Metadata } from "next";
import { Bezel } from "../../components/bezel";
import { ContextForm } from "../../components/context-form";
import { CopyButton } from "../../components/copy-button";
import {
  contextSearchParams,
  projectFromFilters,
  type ContextFilters,
} from "../../lib/context-query";
import { pageMetadata, searchQuery } from "../../lib/present";

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
    "Resolve a feature description into a PromptMarket pattern, guide, and prompt.",
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
  const guide = context?.guides[0];
  const prompt = context?.prompts[0];
  const related = [
    ...(context?.related?.topics ?? []),
    ...(context?.related?.prompts ?? []),
  ].slice(0, 4);

  return (
    <main className="docs">
      <div className="hero-copy">
        <p className="eyebrow">Context</p>
        <h1>What are you building?</h1>
        <p className="lede">
          Describe the feature. PromptMarket resolves a pattern, a guide, and a
          prompt from the catalog. No model call.
        </p>
      </div>

      <ContextForm query={query} filters={filters} />

      {context && topic ? (
        <Bezel coreClassName="panel">
          <p className="eyebrow">Recommended pattern</p>
          <h2>{topic.title}</h2>
          <p>{topic.definition}</p>
          {topic.mentalModel ? <p>{topic.mentalModel}</p> : null}
          {guide ? (
            <>
              <h3>Guide</h3>
              <p>
                <a href={`/guides/${guide.slug}`}>{guide.title}</a>
              </p>
              {guide.architecture.length > 0 ? (
                <p>{guide.architecture.join(" → ")}</p>
              ) : null}
            </>
          ) : null}
          {prompt ? (
            <>
              <h3>Prompt</h3>
              <p>
                <a href={`/prompts/${prompt.name}`}>{prompt.title}</a>
              </p>
            </>
          ) : null}
          {related.length > 0 ? (
            <>
              <h3>Related</h3>
              <ul>
                {related.map(function renderRelated(item) {
                  return (
                    <li key={`${item.kind}-${item.name}`}>
                      <a
                        href={
                          item.kind === "guide"
                            ? `/guides/${item.name}`
                            : item.kind === "prompt"
                              ? `/prompts/${item.name}`
                              : `/learn/${item.name}`
                        }
                      >
                        {item.title}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          <div className="context-actions">
            <CopyButton
              value={formatContextText(context)}
              label="Copy context"
              text="Copy context"
            />
            <CopyButton
              value={formatAgentContext(context)}
              label="Copy for Cursor"
              text="Copy for Cursor"
            />
            {guide ? (
              <a className="pill" href={`/guides/${guide.slug}`}>
                Open guide
              </a>
            ) : null}
            <a className="pill" href="/docs#cursor">
              Set up MCP
            </a>
          </div>
        </Bezel>
      ) : null}

      {plan && plan.steps.length > 0 ? (
        <Bezel coreClassName="panel">
          <p className="eyebrow">Implementation plan</p>
          <h2>{plan.pattern.topic}</h2>
          <p>{plan.pattern.reason}</p>
          {plan.architecture.length > 0 ? (
            <p>{plan.architecture.join(" → ")}</p>
          ) : null}
          <ol>
            {plan.steps.map(function renderStep(step) {
              return (
                <li key={step.sourceSection ?? step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.guidance}</p>
                </li>
              );
            })}
          </ol>
          {plan.verification.length > 0 ? (
            <>
              <h3>Verification</h3>
              <ul>
                {plan.verification.map(function renderCheck(item) {
                  return <li key={item}>{item}</li>;
                })}
              </ul>
            </>
          ) : null}
          <div className="context-actions">
            <CopyButton
              value={formatPlan(plan)}
              label="Copy plan"
              text="Copy plan"
            />
          </div>
        </Bezel>
      ) : null}

      {query && context && !topic ? (
        <Bezel coreClassName="panel">
          <h2>No pattern matched.</h2>
          <p>Try a feature such as RAG, tool calling, or structured output.</p>
        </Bezel>
      ) : null}
    </main>
  );
}
