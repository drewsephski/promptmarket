import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const patterns = [
  {
    slug: "rag",
    title: "Give your model the missing context.",
    label: "Retrieval-augmented generation",
    description:
      "Find the right information. Bring it into the prompt. Get a grounded answer.",
    image: "rag",
    alt: "A database feeds retrieved information into a language model prompt.",
    wide: true,
  },
  {
    slug: "structured-outputs",
    title: "An answer with a shape.",
    label: "Structured outputs",
    description: "Turn a response into data your app can actually use.",
    image: "structured-outputs",
    alt: "A schema with a string field becomes a JSON object containing hello.",
  },
  {
    slug: "tool-calling",
    title: "From words to actions.",
    label: "Tool calling",
    description:
      "Give the model a set of tools and a clear contract for using them.",
    image: "tool-calling",
    alt: "The model selects a web search from a menu of available functions.",
  },
  {
    slug: "workflows",
    title: "Small steps. Clear paths.",
    label: "Workflows",
    description:
      "Connect focused model calls with a stopping point you control.",
    image: "workflows",
    alt: "Three model calls run in sequence before reaching a defined stopping point.",
  },
  {
    slug: "agentic-loops",
    title: "Act. Observe. Repeat.",
    label: "Agentic loops",
    description:
      "Feed tool results back into the next decision, with guardrails.",
    image: "agentic-loops",
    alt: "A model and external APIs exchange actions and results in a loop.",
  },
];

const principles = [
  {
    slug: "building-ai-products",
    title: "Good AI is built in the feedback loop.",
    label: "Building AI products",
    description:
      "Ship a first version. Learn from real usage. Make the next one measurably better.",
    image: "building-ai-products",
    alt: "An initially declining product improves after user feedback, evaluations, and testing new models.",
  },
  {
    slug: "evals",
    title: "Know what better looks like.",
    label: "Evaluations",
    description:
      "Test new prompts and models against real examples before calling them an improvement.",
    image: "evals",
    alt: "New techniques and models feed into evaluations, which improve the product; usage generates data for more evaluations.",
  },
  {
    slug: "ai-engineering-is-experimental",
    title: "Progress is rarely a straight line.",
    label: "Experimentation",
    description: "Try a hypothesis, measure the result, and keep what works.",
    image: "experimentation",
    alt: "Quality fluctuates sharply over time, with successful experiments marking an overall upward trend.",
  },
  {
    slug: "optimization-ladder",
    title: "Start simple. Earn the complexity.",
    label: "The optimization ladder",
    description:
      "Improve the prompt first. Reach for a bigger system when the evidence calls for it.",
    image: "optimization",
    alt: "A staircase moves from zero-shot and few-shot prompting toward workflows, agentic loops, fine-tuning, and more expensive techniques.",
  },
];

const useCases = [
  { image: "structuring-data", label: "Extract" },
  { image: "agents", label: "Take action" },
  { image: "question-answering", label: "Answer" },
  { image: "summarization", label: "Summarize" },
  { image: "classification", label: "Classify" },
  { image: "translation", label: "Translate" },
];

export function RoadmapBento() {
  return (
    <section className="roadmap-section" aria-labelledby="roadmap-heading">
      <header className="roadmap-heading">
        <div>
          <p className="eyebrow">The visual field guide</p>
          <h2 id="roadmap-heading">
            Less mystery.
            <br />
            More understanding.
          </h2>
        </div>
        <div className="roadmap-intro">
          <p>
            A few useful patterns explain a lot of AI. See how the pieces fit,
            then put them to work.
          </p>
          <a href="/learn">
            Explore the lessons <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
      </header>

      <div className="roadmap-grid">
        {patterns.map(function renderPattern(card) {
          return (
            <a
              className={`roadmap-card${card.wide ? " roadmap-card-wide roadmap-card-feature" : ""}`}
              href={`/learn/${card.slug}`}
              key={card.slug}
            >
              <div className="roadmap-card-top">
                <span className="roadmap-label">{card.label}</span>
                <ArrowUpRight
                  className="roadmap-arrow"
                  size={18}
                  aria-hidden="true"
                />
              </div>
              <div className="roadmap-copy">
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
              <div className="roadmap-visual">
                <Image
                  src={`/images/roadmap/${card.image}.webp`}
                  alt={card.alt}
                  fill
                  sizes={
                    card.wide
                      ? "(max-width: 639px) 90vw, (max-width: 959px) 92vw, 540px"
                      : "(max-width: 639px) 90vw, (max-width: 959px) 44vw, 260px"
                  }
                />
              </div>
              <span className="roadmap-card-link">
                Explore the pattern <span aria-hidden="true">↗</span>
              </span>
            </a>
          );
        })}

        <a
          className="roadmap-card roadmap-card-wide roadmap-use-cases"
          href="/learn/what-llms-are-good-at"
        >
          <div className="roadmap-card-top">
            <span className="roadmap-label">Practical use cases</span>
            <ArrowUpRight
              className="roadmap-arrow"
              size={18}
              aria-hidden="true"
            />
          </div>
          <div className="roadmap-copy">
            <h3>Start with a useful job.</h3>
            <p>Six everyday tasks that language models can help with.</p>
          </div>
          <div className="roadmap-use-case-grid">
            {useCases.map(function renderUseCase(item) {
              return (
                <div className="roadmap-use-case" key={item.image}>
                  <div>
                    <Image
                      src={`/images/roadmap/${item.image}.webp`}
                      alt=""
                      fill
                      sizes="(max-width: 639px) 26vw, 160px"
                    />
                  </div>
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
          <span className="roadmap-card-link">
            Find your use case <span aria-hidden="true">↗</span>
          </span>
        </a>

        {principles.map(function renderPrinciple(card) {
          return (
            <a
              className="roadmap-card roadmap-card-wide roadmap-card-chart"
              href={`/learn/${card.slug}`}
              key={card.slug}
            >
              <div className="roadmap-card-top">
                <span className="roadmap-label">{card.label}</span>
                <ArrowUpRight
                  className="roadmap-arrow"
                  size={18}
                  aria-hidden="true"
                />
              </div>
              <div className="roadmap-copy">
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
              <div className="roadmap-visual roadmap-chart-visual">
                <Image
                  src={`/images/roadmap/${card.image}.webp`}
                  alt={card.alt}
                  fill
                  sizes="(max-width: 959px) 90vw, 540px"
                />
              </div>
              <span className="roadmap-card-link">
                Read the field notes <span aria-hidden="true">↗</span>
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
