import { describe, expect, test } from "vitest";
import { previewSteps, stageEmptyCopy } from "../lib/workflow";

describe("workflow presentation", function workflowPresentation() {
  test("previewSteps caps the plan preview", function capsPreview() {
    const steps = Array.from({ length: 10 }, function step(_, index) {
      return { title: `Step ${index + 1}` };
    });
    expect(previewSteps(steps)).toHaveLength(6);
    expect(previewSteps(steps)[0]?.title).toBe("Step 1");
  });

  test("stageEmptyCopy returns stage-specific guidance", function emptyCopy() {
    expect(stageEmptyCopy("debug")).toContain("DevTools");
    expect(stageEmptyCopy("verify")).toContain("eval");
    expect(stageEmptyCopy("docs")).toContain("documentation");
  });
});
