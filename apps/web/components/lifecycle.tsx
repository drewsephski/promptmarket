import type { ImplementationPlan } from "@promptmarket/content";

interface LifecycleProps {
  plan: ImplementationPlan;
}

type StageState = "done" | "current" | "later" | "empty";

interface Stage {
  id: string;
  label: string;
  state: StageState;
  title: string;
  lines: string[];
}

const MARK: Record<StageState, string> = {
  done: "✓",
  current: "→",
  later: "○",
  empty: "·",
};

function stagesFor(plan: ImplementationPlan): Stage[] {
  const docs = plan.documentationTargets;
  const debug = plan.debugTargets[0];
  const evalTarget = plan.evalTargets[0];
  const observe = plan.observabilityTargets[0];
  const cases = evalTarget?.cases.length ?? 0;
  return [
    {
      id: "plan",
      label: "Plan",
      state: "done",
      title: "Build",
      lines: [plan.pattern.topic],
    },
    {
      id: "docs",
      label: "Docs",
      state: docs.length > 0 ? "done" : "empty",
      title: "Current docs",
      lines:
        docs.length > 0
          ? ["Context7", ...docs.map(function nameOf(target) {
              return target.library;
            })]
          : ["No documentation targets"],
    },
    {
      id: "implement",
      label: "Implement",
      state: plan.steps.length > 0 ? "current" : "empty",
      title: "Implement",
      lines:
        plan.steps.length > 0
          ? [`${plan.steps.length} plan steps`]
          : ["No implementation steps"],
    },
    {
      id: "debug",
      label: "Debug",
      state: debug ? "later" : "empty",
      title: "Debug",
      lines: debug ? ["AI SDK DevTools"] : ["No debug target"],
    },
    {
      id: "eval",
      label: "Eval",
      state: evalTarget ? "later" : "empty",
      title: "Verify",
      lines: evalTarget
        ? ["Promptfoo", `${cases} eval ${cases === 1 ? "case" : "cases"}`]
        : ["No eval target"],
    },
    {
      id: "observe",
      label: "Observe",
      state: observe ? "later" : "empty",
      title: "Observe",
      lines: observe
        ? ["Langfuse", "optional production tracing"]
        : ["No observability target"],
    },
  ];
}

export function Lifecycle({ plan }: LifecycleProps) {
  const stages = stagesFor(plan);
  return (
    <section className="lifecycle" aria-label="AI quality loop">
      <p className="eyebrow">Lifecycle</p>
      <ol className="lifecycle-rail">
        {stages.map(function renderStage(stage) {
          return (
            <li key={stage.id} data-state={stage.state}>
              <span className="lifecycle-name">{stage.label}</span>
              <span className="lifecycle-mark" aria-hidden="true">
                {MARK[stage.state]}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="lifecycle-grid">
        {stages.map(function renderDetail(stage) {
          return (
            <div key={stage.id}>
              <h3>{stage.title}</h3>
              {stage.lines.map(function renderLine(line) {
                return <p key={line}>{line}</p>;
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
