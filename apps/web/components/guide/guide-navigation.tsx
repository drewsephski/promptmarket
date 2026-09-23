import type { GuideSummary } from "@promptmarket/content";

interface GuideNavigationProps {
  previous?: GuideSummary;
  next?: GuideSummary;
}

export function GuideNavigation({ previous, next }: GuideNavigationProps) {
  return (
    <nav className="pager" aria-label="Guides">
      {previous ? (
        <a href={previous.href}>
          <span>Previous</span>
          {previous.title}
        </a>
      ) : (
        <a href="/guides">
          <span>Guides</span>
          All guides
        </a>
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
  );
}
