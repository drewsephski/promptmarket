import { loadContentCatalog, moduleTitle } from "@promptmarket/content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlowDiagram } from "../../../components/flow-diagram";
import { SkillBody } from "../../../components/skill-body";
import { pageMetadata } from "../../../lib/present";

interface LearnPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return loadContentCatalog().topics.map(function params(topic) {
    return { slug: topic.slug };
  });
}

export async function generateMetadata({
  params,
}: LearnPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const topic = loadContentCatalog().getTopic(slug);
    return pageMetadata(topic.title, topic.summary, topic.href);
  } catch {
    return { title: "Lesson" };
  }
}

export default async function LearnTopicPage({ params }: LearnPageProps) {
  const { slug } = await params;
  const catalog = loadContentCatalog();
  let topic;
  try {
    topic = catalog.getTopic(slug);
  } catch {
    notFound();
  }
  const index = catalog.topics.findIndex(function matches(item) {
    return item.slug === topic.slug;
  });
  const previous = index > 0 ? catalog.topics[index - 1] : undefined;
  const next = catalog.topics[index + 1];

  return (
    <main className="article">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="/learn">Learn</a>
        <span aria-hidden="true">/</span>
        <a href={`/learn#${topic.module}`}>{moduleTitle(topic.module)}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{topic.title}</span>
      </nav>
      <p className="eyebrow">{moduleTitle(topic.module)}</p>
      <h1>{topic.title}</h1>
      <p className="definition">{topic.definition}</p>

      <section>
        <h2>Mental model</h2>
        <p>{topic.mentalModel}</p>
        <p className="note">{topic.why}</p>
      </section>

      <section className="when-grid">
        <div>
          <h2>When to use</h2>
          <ul>
            {topic.whenToUse.map(function renderUse(item) {
              return <li key={item}>{item}</li>;
            })}
          </ul>
        </div>
        <div>
          <h2>When not to use</h2>
          <ul>
            {topic.whenNotToUse.map(function renderSkip(item) {
              return <li key={item}>{item}</li>;
            })}
          </ul>
        </div>
      </section>

      {topic.diagram ? <FlowDiagram id={topic.diagram} /> : null}

      <section>
        <h2>Example</h2>
        <SkillBody markdown={topic.sections.example} />
      </section>
      <section>
        <h2>Implementation notes</h2>
        <SkillBody markdown={topic.sections.implementationNotes} />
      </section>
      <section>
        <h2>Common mistakes</h2>
        <SkillBody markdown={topic.sections.commonMistakes} />
      </section>

      <section>
        <h2>Related prompts</h2>
        <ul className="related">
          {topic.relatedPrompts.map(function renderPrompt(name) {
            const prompt = catalog.getPrompt(name);
            return (
              <li key={prompt.slug}>
                <a href={prompt.href}>{prompt.title}</a>
                <span>{prompt.description}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {topic.relatedTopics.length > 0 ? (
        <section>
          <h2>Related lessons</h2>
          <ul className="related">
            {topic.relatedTopics.map(function renderTopic(name) {
              const related = catalog.getTopic(name);
              return (
                <li key={related.slug}>
                  <a href={related.href}>{related.title}</a>
                  <span>{related.summary}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <nav className="pager" aria-label="Lessons">
        {previous ? (
          <a href={previous.href}>
            <span>Previous</span>
            {previous.title}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a href={next.href}>
            <span>Next</span>
            {next.title}
          </a>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
