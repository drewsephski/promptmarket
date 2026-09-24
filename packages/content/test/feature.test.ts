import { describe, expect, test } from "vitest";
import {
  assessChangeImpact,
  assessFeature,
  contractFromPlan,
  dependencyChanges,
  featureIdFromGoal,
  formatChangeImpact,
  formatFeatureReviews,
  loadContentCatalog,
  mergeVersions,
  parseFeatureContract,
  pathMatches,
  refreshFeature,
  reviewFeatureChange,
  serializeFeatureContract,
  versionsInFile,
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

  test("matches explicit implementation globs and reports impact", function impact() {
    expect(pathMatches("app/api/chat/**", "app/api/chat/route.ts")).toBe(true);
    expect(pathMatches("lib/rag/**", "lib/rag/retrieval.ts")).toBe(true);
    expect(pathMatches("db/schema.ts", "db/schema.ts")).toBe(true);
    expect(pathMatches("app/api/chat/**", "lib/rag/retrieval.ts")).toBe(false);
    expect(pathMatches("lib/rag/chunk?.ts", "lib/rag/chunk1.ts")).toBe(true);
    expect(pathMatches("lib/rag/chunk[0-9].ts", "lib/rag/chunk2.ts")).toBe(true);
    expect(pathMatches("app/{chat,embed}/route.ts", "app/embed/route.ts")).toBe(true);
    expect(pathMatches("lib/rag/chunk?.ts", "lib/rag/chunk10.ts")).toBe(false);

    const rag = parseFeatureContract(`
schemaVersion: 1
id: internal-docs-rag
goal: answer from internal docs
pattern: rag
guide: rag-knowledge-base
catalog:
  version: test
implementation:
  paths:
    - app/api/chat/**
    - lib/rag/**
eval:
  suite: .promptmarket/evals/internal-docs-rag/promptfooconfig.yaml
`);
    const manager = parseFeatureContract(`
schemaVersion: 1
id: ai-project-manager
goal: manage projects
catalog:
  version: test
implementation:
  paths:
    - convex/**
`);
    const impactReport = assessChangeImpact(
      [rag, manager],
      ["app/api/chat/route.ts", "lib/rag/retrieval.ts", "README.md"],
      {
        "internal-docs-rag": {
          docs: ["Vercel AI SDK", "Drizzle"],
          verification: ["An unsupported question does not hallucinate an answer"],
        },
      },
    );
    const text = formatChangeImpact(impactReport);
    expect(text).toContain("internal-docs-rag");
    expect(text).toContain("Impacted");
    expect(text).toContain("✓ app/api/chat/route.ts");
    expect(text).toContain("Promptfoo: .promptmarket/evals/internal-docs-rag");
    expect(text).toContain("→ Vercel AI SDK");
    expect(text).toContain("Not impacted");
    expect(text).toContain("ai-project-manager");
    expect(impactReport.features.find(function same(feature) {
      return feature.id === "ai-project-manager";
    })?.status).toBe("clear");

    const review = reviewFeatureChange(rag, impactReport.changed, {
      docs: ["Vercel AI SDK", "Drizzle"],
      verification: ["An unsupported question does not hallucinate an answer"],
    });
    const reviewText = formatFeatureReviews([review]);
    expect(reviewText).toContain("retrieval implementation changed");
    expect(reviewText).toContain("AI SDK route changed");
    expect(reviewText).toContain("1. An unsupported question does not hallucinate an answer");
    expect(reviewText).toContain("Promptfoo RAG suite");
    expect(reviewText).toContain("Vercel AI SDK");
  });

  test("contract, eval, and tested dependency changes impact a feature", function implicitImpact() {
    const rag = parseFeatureContract(`
schemaVersion: 1
id: internal-docs-rag
goal: answer from internal docs
pattern: rag
catalog:
  version: test
project:
  testedWith:
    ai: "7"
implementation:
  paths:
    - app/api/chat/**
eval:
  suite: .promptmarket/evals/internal-docs-rag/promptfooconfig.yaml
`);
    const other = parseFeatureContract(`
schemaVersion: 1
id: support-agent
goal: support
catalog:
  version: test
project:
  testedWith:
    zod: "3"
implementation:
  paths:
    - app/api/support/**
`);

    const contractImpact = assessChangeImpact(
      [rag, other],
      [".promptmarket/features/internal-docs-rag.yaml"],
    );
    expect(contractImpact.features.find(function same(feature) {
      return feature.id === "internal-docs-rag";
    })?.status).toBe("impacted");
    expect(contractImpact.features.find(function same(feature) {
      return feature.id === "support-agent";
    })?.status).toBe("clear");

    const evalImpact = assessChangeImpact(
      [rag],
      [".promptmarket/evals/internal-docs-rag/cases.yaml"],
    );
    expect(evalImpact.features[0]?.status).toBe("impacted");
    expect(evalImpact.features[0]?.changed).toContain(
      ".promptmarket/evals/internal-docs-rag/cases.yaml",
    );

    const before = versionsInFile(
      "pnpm-lock.yaml",
      [
        "importers:",
        "  .:",
        "    dependencies:",
        "      ai:",
        "        specifier: ^7.1.0",
        "        version: 7.1.0",
        "      zod:",
        "        specifier: ^3.23.0",
        "        version: 3.23.8",
      ].join("\n"),
    );
    const after = versionsInFile(
      "pnpm-lock.yaml",
      [
        "importers:",
        "  .:",
        "    dependencies:",
        "      ai:",
        "        specifier: ^8.0.0",
        "        version: 8.0.0",
        "      zod:",
        "        specifier: ^3.23.0",
        "        version: 3.23.8",
      ].join("\n"),
    );
    const changes = dependencyChanges(before, after);
    expect(changes).toEqual([{ packageName: "ai", from: "7.1.0", to: "8.0.0" }]);

    const lockImpact = assessChangeImpact([rag, other], ["pnpm-lock.yaml"], {}, {
      dependencyChanges: changes,
    });
    expect(lockImpact.features.find(function same(feature) {
      return feature.id === "internal-docs-rag";
    })?.changed).toContain("ai@7.1.0 → ai@8.0.0");
    expect(lockImpact.features.find(function same(feature) {
      return feature.id === "support-agent";
    })?.status).toBe("clear");

    const unrelated = versionsInFile(
      "package.json",
      JSON.stringify({ dependencies: { zod: "^3.24.0", ai: "^7.1.0" } }),
    );
    const previousManifest = versionsInFile(
      "package.json",
      JSON.stringify({ dependencies: { zod: "^3.23.0", ai: "^7.1.0" } }),
    );
    const mergedBefore = {};
    const mergedAfter = {};
    mergeVersions(mergedBefore, previousManifest);
    mergeVersions(mergedAfter, unrelated);
    expect(dependencyChanges(mergedBefore, mergedAfter).map(function name(change) {
      return change.packageName;
    })).toEqual(["zod"]);

    const review = reviewFeatureChange(rag, [".promptmarket/evals/internal-docs-rag/cases.yaml"], undefined, changes);
    expect(review.risks).toEqual(expect.arrayContaining([
      "eval suite changed",
      "dependency version changed: AI SDK 7.1.0 → 8.0.0",
    ]));
  });
});
