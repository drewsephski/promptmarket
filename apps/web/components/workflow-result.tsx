"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";
import { useTabKeyboard } from "../lib/use-tab-keyboard";
import {
  previewSteps,
  stageEmptyCopy,
  type WorkflowStage,
  type WorkflowView,
} from "../lib/workflow";

interface WorkflowResultProps {
  view: WorkflowView;
  variant?: "full" | "example";
  exampleHref?: string;
}

export function WorkflowResult({
  view,
  variant = "full",
  exampleHref,
}: WorkflowResultProps) {
  const [open, setOpen] = useState<WorkflowStage["id"] | null>(null);
  const shown = previewSteps(view.steps);
  const hiddenCount = view.steps.length - shown.length;
  const active = view.stages.find(function match(stage) {
    return stage.id === open;
  });

  const stageIds = view.stages.map(function idOf(stage) {
    return stage.id;
  });

  function handleStage(id: WorkflowStage["id"]) {
    setOpen(function current(value) {
      return value === id ? null : id;
    });
  }

  const handleStageKeys = useTabKeyboard(
    stageIds,
    open,
    function selectStage(id) {
      setOpen(id);
    },
    function stageTabId(id) {
      return `stage-${id}`;
    },
  );

  return (
    <article className="workflow">
      <header className="workflow-head">
        <p className="workflow-kicker">Build mode</p>
        <h2>{view.pattern}</h2>
        <p>{view.summary}</p>
      </header>
      {view.stack.length > 0 ? (
        <p className="workflow-stack">{view.stack.join(" · ")}</p>
      ) : null}
      {view.architecture.length > 0 ? (
        <p className="workflow-flow">{view.architecture.join(" → ")}</p>
      ) : null}
      {variant === "full" && view.issues.length > 0 ? (
        <ul className="workflow-issues">
          {view.issues.map(function renderIssue(issue) {
            return (
              <li key={issue.title}>
                <strong>{issue.title}</strong>
                {issue.body ? <span>{issue.body}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {variant === "full" && shown.length > 0 ? (
        <ol className="workflow-steps">
          {shown.map(function renderStep(step, index) {
            return (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{step.title}</strong>
                  {step.body ? <p>{step.body}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {variant === "full" && hiddenCount > 0 ? (
        <p className="note">
          {hiddenCount} more {hiddenCount === 1 ? "step" : "steps"} in Plan.
        </p>
      ) : null}
      {variant === "full" && view.verification.length > 0 ? (
        <p className="workflow-verify">
          Verify: {view.verification.slice(0, 2).join(" ")}
        </p>
      ) : null}
      <div
        className="workflow-stages"
        role="tablist"
        aria-label="Workflow stages"
        onKeyDown={variant === "full" ? handleStageKeys : undefined}
      >
        {view.stages.map(function renderStage(stage) {
          const selected = open === stage.id;
          if (variant === "example") {
            return (
              <div key={stage.id} className="workflow-stage">
                <span>{stage.label}</span>
                <strong>{stage.stat}</strong>
              </div>
            );
          }
          return (
            <button
              key={stage.id}
              type="button"
              className="workflow-stage"
              role="tab"
              id={`stage-${stage.id}`}
              aria-selected={selected}
              aria-controls="workflow-stage-panel"
              tabIndex={
                open === null
                  ? stage.id === stageIds[0]
                    ? 0
                    : -1
                  : selected
                    ? 0
                    : -1
              }
              aria-label={`${stage.label}, ${stage.stat}`}
              onClick={function onStage() {
                handleStage(stage.id);
              }}
            >
              <span>{stage.label}</span>
              <strong>{stage.stat}</strong>
            </button>
          );
        })}
      </div>
      {variant === "full" && active ? (
        <div
          className="workflow-panel"
          id="workflow-stage-panel"
          role="tabpanel"
          aria-labelledby={`stage-${active.id}`}
        >
          {active.items.length === 0 ? (
            <p>{stageEmptyCopy(active.id)}</p>
          ) : (
            <ul>
              {active.items.map(function renderItem(item) {
                return (
                  <li key={`${item.title}-${item.body ?? ""}`}>
                    <strong>{item.title}</strong>
                    {item.body ? <p>{item.body}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
      <div className="workflow-actions">
        {variant === "full" ? (
          <CopyButton
            value={view.copyText}
            label="Copy for agent"
            text="Copy for agent"
          />
        ) : null}
        {view.guideHref ? (
          <a className="text-action" href={view.guideHref}>
            Open full guide
          </a>
        ) : null}
        {exampleHref ? (
          <a className="text-action" href={exampleHref}>
            Open this workflow
          </a>
        ) : null}
      </div>
    </article>
  );
}
