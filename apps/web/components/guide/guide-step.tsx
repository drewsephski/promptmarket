import type { GuideSection } from "@promptmarket/content";
import { ArchitectureDiagram } from "./architecture-diagram";
import { GuideBody } from "./guide-body";

interface GuideStepProps {
  section: GuideSection;
  diagram?: string[];
}

export function GuideStep({ section, diagram }: GuideStepProps) {
  return (
    <section className="guide-section" id={section.id}>
      <h2>{section.title}</h2>
      {diagram && diagram.length > 0 ? (
        <ArchitectureDiagram steps={diagram} />
      ) : null}
      <GuideBody markdown={section.markdown} />
    </section>
  );
}
