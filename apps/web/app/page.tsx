import { MODULES, loadContentCatalog } from "@promptmarket/content";
import { Bezel } from "../components/bezel";
import { CommandBlock } from "../components/command-block";
import { FlowDiagram } from "../components/flow-diagram";
import { ArrowMark } from "../components/marks";
import { HOSTED_MCP_URL } from "../lib/present";

const uses = [
  {
    href: "/learn/structured-data",
    title: "Structured data",
    text: "Turn messy text into fields.",
  },
  {
    href: "/learn/classification",
    title: "Classification",
    text: "Pick a label from a list you control.",
  },
  {
    href: "/learn/question-answering",
    title: "Question answering",
    text: "Answer from context you provide.",
  },
  {
    href: "/learn/summarization",
    title: "Summarization",
    text: "Keep the facts a specific reader needs.",
  },
  {
    href: "/learn/agents",
    title: "Agents",
    text: "Request an action. Your code runs it.",
  },
  {
    href: "/learn/what-llms-are-good-at",
    title: "Translation",
    text: "Same meaning, with terms you refuse to paraphrase.",
  },
];

const patterns = [
  {
    href: "/learn/structured-outputs",
    title: "Structured outputs",
    text: "Require data that matches a known shape.",
  },
  {
    href: "/learn/rag",
    title: "RAG",
    text: "Fetch useful information, then put it in the prompt.",
  },
  {
    href: "/learn/tool-calling",
    title: "Tool calling",
    text: "Give the model a list of actions it can request.",
  },
  {
    href: "/learn/workflows",
    title: "Workflows",
    text: "Split one problem into predictable calls.",
  },
  {
    href: "/learn/agentic-loops",
    title: "Agentic loops",
    text: "Choose actions until a stopping condition.",
  },
  {
    href: "/learn/evals",
    title: "Evals",
    text: "The unit test for a model’s behavior.",
  },
];

export default function Home() {
  const catalog = loadContentCatalog();
  const featured = [
    "structured-data-extractor",
    "rag-grounded-answer",
    "tool-selection-router",
    "support-ticket-triage",
  ].map(function lookup(slug) {
    return catalog.getPrompt(slug);
  });
  const lessonCount = catalog.topics.length;
  const moduleCount = MODULES.length;

  return (
    <main>
      <section className="hero hero-simple">
        <div className="hero-copy">
          <p className="eyebrow">PromptMarket</p>
          <h1 className="hero-stack">
            Learn the pattern.
            <br />
            Grab the prompt.
            <br />
            Build.
          </h1>
          <p className="lede">
            Learn the pattern, then copy the prompt into your app.
          </p>
          <div className="cta-row">
            <a className="pill" href="/learn">
              <span>Start learning</span>
              <span className="pill-mark" aria-hidden="true">
                <ArrowMark />
              </span>
            </a>
            <a className="pill pill-quiet" href="/guides">
              <span>Follow a guide</span>
              <span className="pill-mark" aria-hidden="true">
                <ArrowMark />
              </span>
            </a>
          </div>
          <p className="mcp-line">
            Agents can read the same material at{" "}
            <a href="/docs">{HOSTED_MCP_URL}</a>
          </p>
        </div>
      </section>

      <section className="band" aria-labelledby="uses-heading">
        <div className="chapter-head">
          <p className="eyebrow">Start here</p>
          <h2 id="uses-heading">What LLMs are useful for</h2>
        </div>
        <div className="tile-grid">
          {uses.map(function renderUse(item) {
            return (
              <a className="tile" href={item.href} key={item.href}>
                <Bezel coreClassName="tile-core">
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </Bezel>
              </a>
            );
          })}
        </div>
      </section>

      <section className="band" aria-labelledby="patterns-heading">
        <div className="chapter-head">
          <p className="eyebrow">Core patterns</p>
          <h2 id="patterns-heading">How the pieces fit</h2>
        </div>
        <div className="tile-grid">
          {patterns.map(function renderPattern(item) {
            return (
              <a className="tile" href={item.href} key={item.href}>
                <Bezel coreClassName="tile-core">
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </Bezel>
              </a>
            );
          })}
        </div>
      </section>

      <section className="band" aria-labelledby="prompts-heading">
        <div className="chapter-head">
          <p className="eyebrow">Featured prompts</p>
          <h2 id="prompts-heading">Patterns you can copy</h2>
        </div>
        <div className="catalog">
          {featured.map(function renderPrompt(prompt) {
            return (
              <a className="entry" href={prompt.href} key={prompt.slug}>
                <Bezel coreClassName="entry-core">
                  <div className="entry-body">
                    <h3>{prompt.title}</h3>
                    <p>{prompt.description}</p>
                  </div>
                  <span className="pill-mark entry-arrow" aria-hidden="true">
                    <ArrowMark />
                  </span>
                </Bezel>
              </a>
            );
          })}
        </div>
      </section>

      <section className="band" aria-labelledby="guides-heading">
        <div className="chapter-head">
          <p className="eyebrow">Guides</p>
          <h2 id="guides-heading">
            Build a complete app from an empty project.
          </h2>
        </div>
        <p className="lede">
          A guide includes the keys, the database, and the code, and it ends
          with something running on localhost.{" "}
          <a href="/guides/ai-product-brief-builder">
            Start with the product brief generator
          </a>
          .
        </p>
      </section>

      <section className="band ladder-band" aria-labelledby="ladder-heading">
        <div>
          <div className="chapter-head">
            <p className="eyebrow">Start simple</p>
            <h2 id="ladder-heading">
              Only add complexity when the previous step is insufficient.
            </h2>
          </div>
          <p className="lede">
            Later rungs cost more. They are not a maturity score.{" "}
            <a href="/learn/optimization-ladder">Read the ladder</a>.
          </p>
        </div>
        <FlowDiagram id="ladder" />
      </section>

      <section className="band" aria-labelledby="agent-heading">
        <div className="chapter-head">
          <p className="eyebrow">From your agent</p>
          <h2 id="agent-heading">
            The same lessons, prompts, and guides, over MCP.
          </h2>
        </div>
        <Bezel coreClassName="panel">
          <p>
            {lessonCount} lessons across {moduleCount} modules, the prompt
            gallery, and full-stack guides. Installable skills stay available
            when a task is a procedure rather than a prompt.
          </p>
          <CommandBlock command={HOSTED_MCP_URL} label="Copy MCP endpoint" />
          <p className="note">
            <a href="/docs">Setup for Cursor and the CLI</a>
            {" · "}
            <a href="/recipes">Skills</a>
          </p>
        </Bezel>
      </section>
    </main>
  );
}
