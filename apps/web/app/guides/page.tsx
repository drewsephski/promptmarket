import { difficultyLabel, loadContentCatalog } from "@promptmarket/content";
import type { Metadata } from "next";
import { Bezel } from "../../components/bezel";
import { pageMetadata } from "../../lib/present";

export const metadata: Metadata = pageMetadata(
  "Guides",
  "Build complete AI applications from scratch. Each guide starts from a blank Next.js project and ends on localhost.",
  "/guides",
);

const upcoming = [
  {
    title: "AI Project Manager with Convex",
    detail: "Next.js, OpenRouter, Convex",
  },
  {
    title: "Realtime AI Support Room",
    detail: "Next.js, OpenRouter, Supabase",
  },
  {
    title: "AI Research Assistant",
    detail: "Next.js, OpenRouter, Exa, Neon",
  },
];

function conceptLabel(concept: string): string {
  return concept.replaceAll("-", " ");
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
            <a className="entry" href={guide.href} key={guide.slug}>
              <Bezel coreClassName="entry-core">
                <div className="entry-body">
                  <h2>{guide.title}</h2>
                  <p>{guide.description}</p>
                  <div className="entry-meta">
                    <span className="tag">
                      {difficultyLabel(guide.difficulty)}
                    </span>
                    {guide.stack.map(function renderStack(item) {
                      return (
                        <span className="tag" key={item}>
                          {item}
                        </span>
                      );
                    })}
                  </div>
                  <p className="note">
                    {guide.concepts.map(conceptLabel).join(" · ")}
                  </p>
                </div>
              </Bezel>
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
