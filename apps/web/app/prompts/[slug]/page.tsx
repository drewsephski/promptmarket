import { categoryLabel, loadContentCatalog } from "@promptmarket/content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandBlock } from "../../../components/command-block";
import { RelatedGuides } from "../../../components/related-guides";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbData } from "../../../lib/structured-data";
import { pageMetadata } from "../../../lib/present";

interface PromptPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return loadContentCatalog().prompts.map(function params(prompt) {
    return { slug: prompt.slug };
  });
}

export async function generateMetadata({
  params,
}: PromptPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const prompt = loadContentCatalog().getPrompt(slug);
    return pageMetadata(
      prompt.title,
      prompt.description,
      prompt.href,
      "article",
    );
  } catch {
    return { title: "Prompt" };
  }
}

export default async function PromptPage({ params }: PromptPageProps) {
  const { slug } = await params;
  const catalog = loadContentCatalog();
  let prompt;
  try {
    prompt = catalog.getPrompt(slug);
  } catch {
    notFound();
  }

  return (
    <main className="article article-wide">
      <StructuredData
        data={breadcrumbData([
          { name: "Prompts", path: "/prompts" },
          { name: prompt.title, path: prompt.href },
        ])}
      />
      <header className="page-intro">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/prompts">Prompts</a>
          <span aria-hidden="true">/</span>
          <a href={`/prompts?category=${prompt.category}`}>
            {categoryLabel(prompt.category)}
          </a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{prompt.title}</span>
        </nav>
        <p className="eyebrow">Prompt</p>
        <h1>{prompt.title}</h1>
        <p className="lede">{prompt.description}</p>
        <div className="entry-meta prompt-meta">
          <span className="tag">{categoryLabel(prompt.category)}</span>
          <span className="tag">{prompt.difficulty}</span>
          {prompt.tags.map(function renderTag(tag) {
            return (
              <span className="tag" key={tag}>
                {tag}
              </span>
            );
          })}
        </div>
      </header>

      <section>
        <h2>When to use</h2>
        <p>{prompt.whenToUse}</p>
      </section>

      <section>
        <h2>Prompt</h2>
        <CommandBlock command={prompt.body} label={`Copy ${prompt.title}`} />
      </section>

      {prompt.variables.length > 0 ? (
        <section>
          <h2>Variables</h2>
          <ul className="variable-list">
            {prompt.variables.map(function renderVariable(name) {
              return (
                <li key={name}>
                  <code>{`{{${name}}}`}</code>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {prompt.exampleInput && prompt.exampleOutput ? (
        <section>
          <h2>Example</h2>
          <div className="example-grid">
            <div>
              <h3>Input</h3>
              <pre>
                <code>{prompt.exampleInput}</code>
              </pre>
            </div>
            <div>
              <h3>Output</h3>
              <pre>
                <code>{prompt.exampleOutput}</code>
              </pre>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h2>Why it works</h2>
        <p>{prompt.whyItWorks}</p>
      </section>

      <section>
        <h2>Common mistakes</h2>
        <ul>
          {prompt.commonMistakes.map(function renderMistake(mistake) {
            return <li key={mistake}>{mistake}</li>;
          })}
        </ul>
      </section>

      <section>
        <h2>Related concepts</h2>
        <ul className="related">
          {prompt.relatedTopics.map(function renderTopic(name) {
            const topic = catalog.getTopic(name);
            return (
              <li key={topic.slug}>
                <a href={topic.href}>{topic.title}</a>
                <span>{topic.summary}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <RelatedGuides guides={catalog.guidesForPrompt(prompt.slug)} />

      {prompt.relatedPrompts.length > 0 ? (
        <section>
          <h2>Related prompts</h2>
          <ul className="related">
            {prompt.relatedPrompts.map(function renderPrompt(name) {
              const related = catalog.getPrompt(name);
              return (
                <li key={related.slug}>
                  <a href={related.href}>{related.title}</a>
                  <span>{related.description}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
