import type { GuideSection } from "@promptmarket/content";

interface GuideTableOfContentsProps {
  sections: GuideSection[];
}

export function GuideTableOfContents({ sections }: GuideTableOfContentsProps) {
  return (
    <nav className="guide-toc" aria-label="On this page">
      <p className="eyebrow">On this page</p>
      <ol>
        {sections.map(function renderSection(section) {
          return (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
