import type { DiagramId } from "@promptmarket/content";

const FLOWS: Record<
  DiagramId,
  { label: string; steps: string[]; loop?: string }
> = {
  extract: {
    label: "From messy text to a JSON object",
    steps: ["Messy text", "Schema", "Model", "JSON object"],
  },
  rag: {
    label: "Retrieval before answering",
    steps: ["Question", "Retrieve context", "Prompt + context", "Answer"],
  },
  agent: {
    label: "Agent loop",
    steps: ["Goal", "Model", "Tool", "Result"],
    loop: "The result goes back to the model until a stop condition.",
  },
  tools: {
    label: "A tool request",
    steps: [
      "Request",
      "Choose a tool",
      "Validate arguments",
      "Your code runs it",
    ],
  },
  workflow: {
    label: "A fixed workflow",
    steps: ["Input", "Step one", "Step two", "Checked result"],
  },
  eval: {
    label: "Eval loop",
    steps: ["Prompt or system", "Examples", "Score", "Improve"],
    loop: "Score the same examples again after you change the prompt or system.",
  },
  ladder: {
    label: "Add complexity only when the previous step is not enough",
    steps: [
      "Zero-shot",
      "Examples",
      "Workflow",
      "Evals",
      "Agent",
      "Advanced optimization",
    ],
  },
};

export function FlowDiagram({ id }: { id: DiagramId }) {
  const flow = FLOWS[id];
  return (
    <figure className="flow-figure">
      <figcaption className="sr-only">{flow.label}</figcaption>
      <ol className="flow" aria-label={flow.label}>
        {flow.steps.map(function renderStep(step, index) {
          return (
            <li key={step}>
              {index > 0 ? (
                <span className="flow-arrow" aria-hidden="true">
                  ↓
                </span>
              ) : null}
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
      {flow.loop ? (
        <p className="flow-loop">
          <span aria-hidden="true">↺ </span>
          {flow.loop}
        </p>
      ) : null}
    </figure>
  );
}
