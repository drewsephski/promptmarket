import {
  buildContext,
  buildPlan,
  formatAgentContext,
  loadContentCatalog,
} from "@promptmarket/content";
import { CommandBlock } from "../components/command-block";
import { WorkflowResult } from "../components/workflow-result";
import { workflowView } from "../lib/workflow";

const EXAMPLE_QUERY = "Add a RAG knowledge base";
const CURSOR_SETUP =
  "pnpm dlx @promptmarket/cli setup cursor --write --with-context7";

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
    title: "Prompts",
    text: "Reuse proven patterns.",
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
            <a href="/docs#cursor">Install for Cursor</a>
          </p>
        </div>
      </section>

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
        <CommandBlock command={CURSOR_SETUP} label="Copy command" />
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
