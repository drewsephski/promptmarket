import { describe, expect, test } from "vitest";
import {
  includeProductionCases,
  productionCases,
} from "../src/langfuse-sync.js";

describe("langfuse dataset sync", function langfuseSync() {
  test("skips items that have no curated expected output", function skipsRawTraces() {
    const translated = productionCases([
      {
        id: "raw",
        input: "What is the refund policy?",
        sourceTraceId: "trace-raw",
      },
      {
        id: "curated",
        input: { text: "Where is the handbook?" },
        expectedOutput: "Refuse when the handbook does not say.",
        sourceTraceId: "trace-curated",
        sourceObservationId: "obs-1",
      },
    ]);

    expect(translated.skipped).toBe(1);
    expect(translated.cases).toHaveLength(1);
    expect(translated.cases[0]?.vars.input).toBe("Where is the handbook?");
    expect(translated.cases[0]?.assert).toEqual([
      { type: "equals", value: "Refuse when the handbook does not say." },
    ]);
    expect(translated.cases[0]?.metadata?.sourceTraceId).toBe("trace-curated");
    expect(JSON.stringify(translated.cases)).not.toContain("trace-raw");
  });

  test("adds the production file beside the existing suite", function includesFile() {
    const next = includeProductionCases("tests: file://cases.yaml\n");
    expect(next).toContain("file://cases.yaml");
    expect(next).toContain("file://production-cases.yaml");
  });
});
