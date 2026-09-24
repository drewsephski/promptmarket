import {
  buildContext,
  buildPlan,
  formatAgentContext,
  loadContentCatalog,
} from "@promptmarket/content";
import { AgentSetup } from "../components/agent-setup";
import { RoadmapBento } from "../components/roadmap-bento";
import { WorkflowResult } from "../components/workflow-result";
import { workflowView } from "../lib/workflow";

import { StructuredData } from "../components/structured-data";
import { pageMetadata, SITE_URL } from "../lib/present";

export const metadata = pageMetadata(
  "AI Engineering Patterns & Coding Agent Context",
  "Build AI features with reusable prompts, agent skills, and implementation guides for RAG, tool calling, structured outputs, and evaluations.",
  "/",
);

const EXAMPLE_QUERY = "Add a RAG knowledge base";

const entries = [
  {
    href: "/learn",
    title: "Learn",
    text: "Understand the patterns.",
  },
  {
    href: "/guides",
    title: "Guides",
    text: "Build full apps.",
  },
  {
    href: "/prompts",
    title: "AI agent prompts",
    text: "Copy templates for tools, RAG, and structured outputs.",
  },
];

export default function Home() {
  const catalog = loadContentCatalog();
  const context = buildContext(catalog, {
    query: EXAMPLE_QUERY,
    detail: "compact",
    maxItems: 4,
  });
  const plan = buildPlan(catalog, { query: EXAMPLE_QUERY });
  const topic = context.topics[0];
  const example = topic
    ? workflowView(plan, topic.definition, formatAgentContext(context))
    : undefined;

  return (
    <main>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "PromptMarket",
          url: SITE_URL,
        }}
      />
      <section className="hero hero-simple">
        <div className="hero-copy">
          <p className="eyebrow">PromptMarket</p>
          <h1>Build AI features with the right context.</h1>
          <p className="lede">
            Describe what you are adding. PromptMarket picks the pattern, gives
            you an implementation plan, and tells your coding agent what to
            verify.
          </p>
          <form className="resolver" action="/context" method="get">
            <label>
              <span className="sr-only">What are you building?</span>
              <input
                name="q"
                placeholder="Add RAG over our internal docs..."
                aria-label="What are you building?"
              />
            </label>
            <button className="pill" type="submit">
              Resolve
            </button>
          </form>
          <p className="mcp-line">
            <a href="/docs#agents">Install</a>
          </p>
        </div>
      </section>

      <RoadmapBento />

      {example ? (
        <section className="band" aria-labelledby="example-heading">
          <div className="chapter-head">
            <p className="eyebrow">Example</p>
            <h2 id="example-heading">One resolved workflow</h2>
          </div>
          <WorkflowResult
            view={example}
            variant="example"
            exampleHref={`/context?q=${encodeURIComponent(EXAMPLE_QUERY)}`}
          />
        </section>
      ) : null}

      <section className="band" aria-labelledby="agent-heading">
        <div className="chapter-head">
          <p className="eyebrow">Use it where you work</p>
          <h2 id="agent-heading">Works with your coding agent</h2>
        </div>
        <AgentSetup />
      </section>

      <section className="band" aria-labelledby="entries-heading">
        <h2 id="entries-heading" className="sr-only">
          Other ways in
        </h2>
        <div className="entry-points">
          {entries.map(function renderEntry(item) {
            return (
              <a key={item.href} href={item.href}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}
