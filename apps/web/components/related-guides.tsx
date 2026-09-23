import type { GuideSummary } from "@promptmarket/content";

interface RelatedGuidesProps {
  guides: GuideSummary[];
}

export function RelatedGuides({ guides }: RelatedGuidesProps) {
  if (guides.length === 0) {
    return null;
  }

  return (
    <section>
      <h2>Build this</h2>
      <ul className="related">
        {guides.map(function renderGuide(guide) {
          return (
            <li key={guide.slug}>
              <a href={guide.href}>{guide.title}</a>
              <span>{guide.description}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
