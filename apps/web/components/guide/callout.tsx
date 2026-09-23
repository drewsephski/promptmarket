import type { ReactNode } from "react";
import type { CalloutKind } from "../../lib/guide-markdown";

interface CalloutProps {
  kind: CalloutKind;
  children: ReactNode;
}

const labels: Record<CalloutKind, string> = {
  checkpoint: "Checkpoint",
  note: "Note",
  warning: "Warning",
};

export function Callout({ kind, children }: CalloutProps) {
  return (
    <aside className={`callout callout-${kind}`} role="note">
      <p className="callout-label">{labels[kind]}</p>
      <div className="callout-body">{children}</div>
    </aside>
  );
}

export function Checkpoint({ children }: { children: ReactNode }) {
  return <Callout kind="checkpoint">{children}</Callout>;
}
