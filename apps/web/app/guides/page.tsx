import { difficultyLabel, loadContentCatalog } from "@promptmarket/content";
import type { Metadata } from "next";
import { pageMetadata } from "../../lib/present";

export const metadata: Metadata = pageMetadata(
  "Guides",
  "Build complete AI applications from scratch. Each guide starts from a blank Next.js project and ends on localhost.",
  "/guides",
);

const upcoming = [
  {
    title: "Realtime AI Support Room",
    detail: "Next.js, OpenRouter, Supabase",
  },
  {
    title: "AI Research Assistant",
    detail: "Next.js, OpenRouter, Exa, Neon",
  },
];

const PATTERN_LABELS: Record<string, string> = {
  rag: "RAG",
  "structured-outputs": "Structured outputs",
  "tool-calling": "Tool calling",
};

function patternOf(concepts: string[]): string {
  const match = concepts.find(function known(concept) {
    return concept in PATTERN_LABELS;
  });
  return (
    PATTERN_LABELS[match ?? ""] ?? concepts[0]?.replaceAll("-", " ") ?? "Guide"
  );
}

function timeLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(" minutes", " min").replace(/^(\d+)/, "~$1");
}

function stackLine(stack: string[]): string {
  return stack
    .filter(function skip(item) {
      return item !== "TypeScript";
    })
    .slice(0, 3)
    .join(" · ");
}

export default function GuidesPage() {
  const guides = loadContentCatalog().guides;

  return (
    <main className="article article-wide">
      <header className="page-intro">
        <p className="eyebrow">Guides</p>
        <h1>Build complete AI applications from scratch.</h1>
        <p className="lede">
          Blank project to a running app. Each guide ends on localhost.
        </p>
      </header>
      <div className="catalog">
        {guides.map(function renderGuide(guide) {
          return (
            <a className="prompt-card" href={guide.href} key={guide.slug}>
              <p className="workflow-kicker">{patternOf(guide.concepts)}</p>
              <h2>{guide.title}</h2>
              <p>{guide.description}</p>
              <span>
                {[
                  difficultyLabel(guide.difficulty),
                  timeLabel(guide.estimatedTime),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="prompt-stack">{stackLine(guide.stack)}</span>
            </a>
          );
        })}
      </div>
      <section className="upcoming" aria-labelledby="upcoming-guides">
        <h2 id="upcoming-guides">Coming next</h2>
        <ul>
          {upcoming.map(function renderUpcoming(item) {
            return (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
