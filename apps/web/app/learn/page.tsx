import { MODULES, loadContentCatalog } from "@promptmarket/content";
import type { Metadata } from "next";
import { pageMetadata } from "../../lib/present";

export const metadata: Metadata = pageMetadata(
  "Learn",
  "A short AI engineering roadmap: what models are good at, the core patterns, and why evals come before more architecture.",
  "/learn",
);

export default function LearnIndexPage() {
  const topics = loadContentCatalog().topics;
  return (
    <main className="article article-wide">
      <header className="page-intro">
        <p className="eyebrow">Roadmap</p>
        <h1>Learn how AI apps actually work.</h1>
        <p className="lede">
          Short lessons. Each one ends at a prompt you can copy.
        </p>
      </header>
      {MODULES.map(function renderModule(module) {
        const lessons = topics.filter(function inModule(topic) {
          return topic.module === module.id;
        });
        return (
          <section className="module" id={module.id} key={module.id}>
            <h2>{module.title}</h2>
            <p className="note">{module.description}</p>
            <ol className="lesson-list">
              {lessons.map(function renderLesson(topic) {
                return (
                  <li key={topic.slug}>
                    <a href={topic.href}>
                      <span className="lesson-index">
                        {String(topic.order).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{topic.title}</strong>
                        <span>{topic.summary}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </main>
  );
}
