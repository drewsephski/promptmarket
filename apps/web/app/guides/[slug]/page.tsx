import { loadContentCatalog } from "@promptmarket/content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideHeader } from "../../../components/guide/guide-header";
import { GuideNavigation } from "../../../components/guide/guide-navigation";
import { GuideStep } from "../../../components/guide/guide-step";
import { GuideTableOfContents } from "../../../components/guide/guide-toc";
import { pageMetadata } from "../../../lib/present";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return loadContentCatalog().guides.map(function params(guide) {
    return { slug: guide.slug };
  });
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const guide = loadContentCatalog().getGuide(slug);
    return pageMetadata(guide.title, guide.description, guide.href);
  } catch {
    return { title: "Guide" };
  }
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const catalog = loadContentCatalog();
  let guide;
  try {
    guide = catalog.getGuide(slug);
  } catch {
    notFound();
  }
  const index = catalog.guides.findIndex(function matches(item) {
    return item.slug === guide.slug;
  });
  const previous = index > 0 ? catalog.guides[index - 1] : undefined;
  const next = catalog.guides[index + 1];

  return (
    <main className="guide">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="/guides">Guides</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{guide.title}</span>
      </nav>
      <GuideHeader guide={guide} />
      <div className="guide-layout">
        <GuideTableOfContents sections={guide.sections} />
        <article>
          {guide.sections.map(function renderSection(section, sectionIndex) {
            return (
              <GuideStep
                key={section.id}
                section={section}
                diagram={sectionIndex === 0 ? guide.architecture : undefined}
              />
            );
          })}
          <section>
            <h2>Related lessons</h2>
            <ul className="related">
              {guide.relatedTopics.map(function renderTopic(name) {
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
          <section>
            <h2>Related prompts</h2>
            <ul className="related">
              {guide.relatedPrompts.map(function renderPrompt(name) {
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
          <GuideNavigation previous={previous} next={next} />
        </article>
      </div>
    </main>
  );
}
