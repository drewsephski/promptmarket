interface ArchitectureDiagramProps {
  steps: string[];
  label?: string;
}

export function ArchitectureDiagram({
  steps,
  label = "Architecture",
}: ArchitectureDiagramProps) {
  return (
    <figure className="flow-figure">
      <figcaption className="sr-only">{label}</figcaption>
      <ol className="flow" aria-label={label}>
        {steps.map(function renderStep(step, index) {
          return (
            <li key={step}>
              {index > 0 ? (
                <span className="flow-arrow" aria-hidden="true">
                  →
                </span>
              ) : null}
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
