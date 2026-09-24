import { describe, expect, test } from "vitest";
import {
  assessFeature,
  contractFromPlan,
  featureIdFromGoal,
  loadContentCatalog,
  parseFeatureContract,
  refreshFeature,
  serializeFeatureContract,
  buildPlan,
} from "../src/index.js";
import type { ProjectContext } from "../src/project.js";

const project: ProjectContext = {
  framework: "Next.js",
  language: "TypeScript",
  packages: ["next", "ai", "drizzle-orm"],
  versions: {
    next: "16.2.0",
    ai: "7.1.0",
    "drizzle-orm": "0.45.1",
  },
  ai: { sdk: "Vercel AI SDK" },
  orm: ["Drizzle"],
};

describe("feature contracts", function featureContracts() {
  test("slugs a goal and round-trips a small manifest", function roundTrip() {
    const catalog = loadContentCatalog();
    const plan = buildPlan(catalog, {
      query: "add RAG over internal documentation",
      project,
    });
    const contract = contractFromPlan(plan, "abc1234", featureIdFromGoal(plan.goal));
    const parsed = parseFeatureContract(serializeFeatureContract(contract));

    expect(contract.id).toBe("rag-internal-docs");
    expect(contract.guide).toBe("rag-knowledge-base");
    expect(contract.prompt).toBe("rag-grounded-answer");
    expect(contract.pattern).toBe("rag");
    expect(contract.eval?.suite).toBe(
      ".promptmarket/evals/rag-internal-docs/promptfooconfig.yaml",
    );
    expect(contract.observability?.provider).toBe("langfuse");
    expect(parsed).toEqual(contract);
    expect(serializeFeatureContract(contract)).not.toContain("architecture:");
  });

  test("warns on a newer guide and fails on a missing eval suite", function status() {
    const catalog = loadContentCatalog();
    const plan = buildPlan(catalog, {
      query: "add RAG over internal documentation",
      project,
    });
    const contract = contractFromPlan(plan, "abc1234");
    contract.catalog.guideVerifiedAt = "2000-01-01";
    const assessment = assessFeature(contract, catalog, project, {
      evalSuiteExists: false,
      workflowExists: false,
      langfuseDetected: false,
    });

    expect(assessment.errors.map(function code(check) {
      return check.code;
    })).toContain("eval-missing");
    expect(assessment.warnings.map(function code(check) {
      return check.code;
    })).toEqual(expect.arrayContaining(["guide-newer", "workflow-missing", "langfuse-missing"]));
    expect(assessment.errors.some(function hard(check) {
      return check.code === "package-major" || check.code === "guide-newer";
    })).toBe(false);
  });

  test("fails when a declared major is unsupported", function unsupportedMajor() {
    const catalog = loadContentCatalog();
    const plan = buildPlan(catalog, {
      query: "add RAG over internal documentation",
      project,
    });
    const contract = contractFromPlan(plan, "abc1234");
    contract.project = {
      testedWith: { ai: "7" },
      unsupported: { ai: ["8"] },
    };
    const drifted: ProjectContext = {
      ...project,
      versions: { ...project.versions, ai: "8.0.0" },
    };
    const assessment = assessFeature(contract, catalog, drifted, {
      evalSuiteExists: true,
      workflowExists: true,
      langfuseDetected: true,
    });

    expect(assessment.errors.map(function code(check) {
      return check.code;
    })).toContain("unsupported-major");
  });

  test("refresh updates metadata and holds a retargeted guide", function refresh() {
    const catalog = loadContentCatalog();
    const plan = buildPlan(catalog, {
      query: "add RAG over internal documentation",
      project,
    });
    const contract = contractFromPlan(plan, "oldhash");
    contract.catalog.guideVerifiedAt = "2000-01-01";
    const diff = refreshFeature(contract, plan, "newhash");

    expect(diff.wrote).toEqual(expect.arrayContaining(["catalog.version", "catalog.guideVerifiedAt"]));
    expect(diff.next.guide).toBe(contract.guide);
    expect(diff.next.id).toBe(contract.id);
  });
});
