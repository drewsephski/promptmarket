import { difficultyLabel, type Guide } from "@promptmarket/content";

interface GuideHeaderProps {
  guide: Guide;
}

function FactList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2>{title}</h2>
      <ul>
        {items.map(function renderItem(item) {
          return <li key={item}>{item}</li>;
        })}
      </ul>
    </section>
  );
}

export function GuideHeader({ guide }: GuideHeaderProps) {
  return (
    <header className="guide-header">
      <div className="page-intro">
        <p className="eyebrow">Guide</p>
        <h1>{guide.title}</h1>
        <p className="lede">{guide.description}</p>
      </div>
      <div className="entry-meta guide-meta">
        <span className="tag">{difficultyLabel(guide.difficulty)}</span>
        {guide.estimatedTime ? (
          <span className="tag">{guide.estimatedTime}</span>
        ) : null}
        {guide.verifiedAt ? (
          <span className="tag">Verified {guide.verifiedAt}</span>
        ) : null}
        {guide.stack.map(function renderStack(item) {
          return (
            <span className="tag" key={item}>
              {item}
            </span>
          );
        })}
      </div>
      <div className="guide-facts">
        <FactList title="What you'll build" items={guide.whatYouBuild} />
        <FactList title="What you'll learn" items={guide.whatYouLearn} />
        <FactList title="Prerequisites" items={guide.prerequisites} />
      </div>
    </header>
  );
}
