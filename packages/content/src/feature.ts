import picomatch from "picomatch";
import { stringify, parse } from "yaml";
import { packageLabel, versionsMatch } from "./compatibility.js";
import {
  formatDependencyChange,
  type DependencyChange,
} from "./dependency-versions.js";
import type { ContentCatalog } from "./load.js";
import type { ImplementationPlan } from "./plan.js";
import type { ProjectContext } from "./project.js";

const STOP = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "of",
  "over",
  "our",
  "with",
  "and",
  "or",
  "in",
  "on",
  "into",
  "from",
  "your",
  "my",
]);

const LEADING_VERBS = new Set([
  "add",
  "build",
  "implement",
  "create",
  "make",
  "write",
]);

export type FeatureContract = {
  schemaVersion: 1;
  id: string;
  goal: string;
  pattern?: string;
  guide?: string;
  prompt?: string;
  catalog: {
    version: string;
    guideVerifiedAt?: string;
  };
  project?: {
    testedWith: Record<string, string>;
    unsupported?: Record<string, string[]>;
  };
  implementation?: {
    paths: string[];
  };
  eval?: {
    suite: string;
  };
  observability?: {
    provider: "langfuse";
  };
  ci?: {
    required: boolean;
  };
};

export type FeatureCheckLevel = "pass" | "warn" | "fail" | "open";

export type FeatureCheck = {
  group: "architecture" | "compatibility" | "quality" | "catalog";
  level: FeatureCheckLevel;
  code: string;
  message: string;
};

export type FeatureAssessment = {
  id: string;
  pattern?: string;
  guide?: string;
  checks: FeatureCheck[];
  errors: FeatureCheck[];
  warnings: FeatureCheck[];
};

export type FeatureEvidence = {
  evalSuiteExists: boolean;
  workflowExists: boolean;
  langfuseDetected: boolean;
};

export type FeatureRefresh = {
  id: string;
  wrote: string[];
  held: string[];
  lines: string[];
  next: FeatureContract;
};

const MARK: Record<FeatureCheckLevel, string> = {
  pass: "✓",
  warn: "!",
  fail: "✗",
  open: "○",
};

export function featureIdFromGoal(goal: string): string {
  const words = goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(function keep(word, index) {
      if (index === 0 && LEADING_VERBS.has(word)) {
        return false;
      }
      return word.length > 0 && !STOP.has(word);
    })
    .map(function shorten(word) {
      if (word === "documentation" || word === "documents") {
        return "docs";
      }
      return word;
    });
  const slug = words.join("-").replace(/-+/g, "-").slice(0, 48).replace(/-$/, "");
  return slug.length > 0 ? slug : "feature";
}

export function contractFromPlan(
  plan: ImplementationPlan,
  catalogVersion: string,
  id?: string,
  paths?: string[],
): FeatureContract {
  const guide = plan.guide;
  const testedWith: Record<string, string> = {};
  for (const item of plan.compatibility) {
    testedWith[item.packageName] = item.tested;
  }
  const pattern = plan.evalTargets[0]?.kind;
  const suiteId = id ?? featureIdFromGoal(plan.goal);
  const contract: FeatureContract = {
    schemaVersion: 1,
    id: suiteId,
    goal: plan.goal,
    ...(pattern ? { pattern } : {}),
    ...(guide ? { guide: guide.slug } : {}),
    ...(plan.prompt ? { prompt: plan.prompt.name } : {}),
    catalog: {
      version: catalogVersion,
      ...(guide?.verifiedAt ? { guideVerifiedAt: guide.verifiedAt } : {}),
    },
  };
  if (Object.keys(testedWith).length > 0) {
    contract.project = { testedWith };
  }
  if (plan.evalTargets[0]) {
    contract.eval = {
      suite: `.promptmarket/evals/${suiteId}/promptfooconfig.yaml`,
    };
  }
  const owned = normalizePaths(paths ?? []);
  if (owned.length > 0) {
    contract.implementation = { paths: owned };
  }
  if (plan.observabilityTargets.some(function langfuse(target) {
    return target.provider === "langfuse";
  })) {
    contract.observability = { provider: "langfuse" };
  }
  return contract;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string, file: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${file}: ${key} must be a non-empty string`);
  }
  return value;
}

function stringMap(value: unknown, file: string, key: string): Record<string, string> {
  if (!isRecord(value)) {
    throw new Error(`${file}: ${key} must be a map of package names to versions`);
  }
  const mapped: Record<string, string> = {};
  for (const [name, version] of Object.entries(value)) {
    if (typeof version !== "string") {
      throw new Error(`${file}: ${key}.${name} must be a string`);
    }
    mapped[name] = version;
  }
  return mapped;
}

export function parseFeatureContract(raw: string, file = "feature"): FeatureContract {
  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid YAML";
    throw new Error(`${file}: ${message}`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`${file}: expected a YAML object`);
  }
  if (parsed.schemaVersion !== 1) {
    throw new Error(`${file}: schemaVersion must be 1`);
  }
  const catalog = parsed.catalog;
  if (!isRecord(catalog)) {
    throw new Error(`${file}: catalog is required`);
  }
  const contract: FeatureContract = {
    schemaVersion: 1,
    id: stringField(parsed, "id", file),
    goal: stringField(parsed, "goal", file),
    catalog: {
      version: stringField(catalog, "version", file),
    },
  };
  if (typeof parsed.pattern === "string") {
    contract.pattern = parsed.pattern;
  }
  if (typeof parsed.guide === "string") {
    contract.guide = parsed.guide;
  }
  if (typeof parsed.prompt === "string") {
    contract.prompt = parsed.prompt;
  }
  if (typeof catalog.guideVerifiedAt === "string") {
    contract.catalog.guideVerifiedAt = catalog.guideVerifiedAt;
  }
  if (parsed.project !== undefined) {
    if (!isRecord(parsed.project)) {
      throw new Error(`${file}: project must be an object`);
    }
    const testedWith = stringMap(parsed.project.testedWith ?? {}, file, "project.testedWith");
    const project: NonNullable<FeatureContract["project"]> = { testedWith };
    if (parsed.project.unsupported !== undefined) {
      if (!isRecord(parsed.project.unsupported)) {
        throw new Error(`${file}: project.unsupported must be an object`);
      }
      const unsupported: Record<string, string[]> = {};
      for (const [name, majors] of Object.entries(parsed.project.unsupported)) {
        if (!Array.isArray(majors) || majors.some(function bad(item) {
          return typeof item !== "string";
        })) {
          throw new Error(`${file}: project.unsupported.${name} must be a list of majors`);
        }
        unsupported[name] = majors;
      }
      project.unsupported = unsupported;
    }
    contract.project = project;
  }
  if (parsed.implementation !== undefined) {
    if (!isRecord(parsed.implementation) || !Array.isArray(parsed.implementation.paths)) {
      throw new Error(`${file}: implementation.paths must be a list of path globs`);
    }
    const paths = parsed.implementation.paths.map(function pathOf(item) {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`${file}: implementation.paths must be non-empty globs`);
      }
      return item.trim();
    });
    if (paths.length === 0) {
      throw new Error(`${file}: implementation.paths must list at least one glob`);
    }
    contract.implementation = { paths };
  }
  if (parsed.eval !== undefined) {
    if (!isRecord(parsed.eval)) {
      throw new Error(`${file}: eval must be an object`);
    }
    contract.eval = { suite: stringField(parsed.eval, "suite", file) };
  }
  if (parsed.observability !== undefined) {
    if (!isRecord(parsed.observability) || parsed.observability.provider !== "langfuse") {
      throw new Error(`${file}: observability.provider must be langfuse`);
    }
    contract.observability = { provider: "langfuse" };
  }
  if (parsed.ci !== undefined) {
    if (!isRecord(parsed.ci) || typeof parsed.ci.required !== "boolean") {
      throw new Error(`${file}: ci.required must be a boolean`);
    }
    contract.ci = { required: parsed.ci.required };
  }
  return contract;
}

export function serializeFeatureContract(contract: FeatureContract): string {
  return stringify(contract);
}

function majorOf(version: string): string | undefined {
  const match = /(\d+)/.exec(version);
  return match?.[1];
}

function sameMajor(detected: string, tested: string): boolean {
  const left = majorOf(detected);
  const right = majorOf(tested);
  return Boolean(left && right && left === right);
}

export function assessFeature(
  contract: FeatureContract,
  catalog: ContentCatalog,
  project: ProjectContext | undefined,
  evidence: FeatureEvidence,
): FeatureAssessment {
  const checks: FeatureCheck[] = [];
  if (contract.guide) {
    const guide = catalog.guides.find(function same(item) {
      return item.slug === contract.guide;
    });
    checks.push(
      guide
        ? {
            group: "architecture",
            level: "pass",
            code: "guide-available",
            message: "catalog entry available",
          }
        : {
            group: "architecture",
            level: "fail",
            code: "guide-missing",
            message: `guide ${contract.guide} deleted`,
          },
    );
    if (guide?.verifiedAt && contract.catalog.guideVerifiedAt && guide.verifiedAt !== contract.catalog.guideVerifiedAt) {
      checks.push({
        group: "catalog",
        level: "warn",
        code: "guide-newer",
        message: "guide updated since this feature was initialized",
      });
    } else if (guide) {
      checks.push({
        group: "catalog",
        level: "pass",
        code: "guide-current",
        message: "guide matches the contract",
      });
    }
  }
  if (contract.prompt) {
    const prompt = catalog.prompts.find(function same(item) {
      return item.slug === contract.prompt;
    });
    checks.push(
      prompt
        ? {
            group: "architecture",
            level: "pass",
            code: "prompt-available",
            message: "prompt available",
          }
        : {
            group: "architecture",
            level: "fail",
            code: "prompt-missing",
            message: `prompt ${contract.prompt} deleted`,
          },
    );
  }
  const testedWith = contract.project?.testedWith ?? {};
  for (const [packageName, tested] of Object.entries(testedWith)) {
    const detected = project?.versions[packageName];
    const label = packageLabel(packageName);
    if (!detected) {
      checks.push({
        group: "compatibility",
        level: "open",
        code: "package-missing",
        message: `${label} ${tested} not detected`,
      });
      continue;
    }
    if (versionsMatch(detected, tested)) {
      checks.push({
        group: "compatibility",
        level: "pass",
        code: "package-match",
        message: `${label} ${tested}`,
      });
      continue;
    }
    const unsupported = contract.project?.unsupported?.[packageName] ?? [];
    const detectedMajor = majorOf(detected);
    const blocked = detectedMajor ? unsupported.includes(detectedMajor) : false;
    checks.push({
      group: "compatibility",
      level: blocked ? "fail" : "warn",
      code: blocked ? "unsupported-major" : sameMajor(detected, tested) ? "package-minor" : "package-major",
      message: `${label} ${tested} → project now declares ${detected}`,
    });
  }
  if (contract.eval) {
    checks.push(
      evidence.evalSuiteExists
        ? {
            group: "quality",
            level: "pass",
            code: "eval-suite",
            message: "Promptfoo suite",
          }
        : {
            group: "quality",
            level: "fail",
            code: "eval-missing",
            message: `eval suite missing (${contract.eval.suite})`,
          },
    );
    const required = contract.ci?.required === true;
    if (evidence.workflowExists) {
      checks.push({
        group: "quality",
        level: "pass",
        code: "eval-workflow",
        message: "PR eval workflow",
      });
    } else {
      checks.push({
        group: "quality",
        level: required ? "fail" : "warn",
        code: required ? "workflow-required" : "workflow-missing",
        message: required
          ? "required Promptfoo workflow missing"
          : "PR eval workflow not found",
      });
    }
  }
  if (contract.observability?.provider === "langfuse") {
    checks.push({
      group: "quality",
      level: "open",
      code: "langfuse-declared",
      message: "Langfuse target declared",
    });
    checks.push({
      group: "quality",
      level: evidence.langfuseDetected ? "open" : "warn",
      code: evidence.langfuseDetected ? "langfuse-unverified" : "langfuse-missing",
      message: evidence.langfuseDetected
        ? "Langfuse instrumentation not verified"
        : "Langfuse not detected",
    });
  }
  return {
    id: contract.id,
    ...(contract.pattern ? { pattern: contract.pattern } : {}),
    ...(contract.guide ? { guide: contract.guide } : {}),
    checks,
    errors: checks.filter(function failed(check) {
      return check.level === "fail";
    }),
    warnings: checks.filter(function warned(check) {
      return check.level === "warn";
    }),
  };
}

function section(title: string, checks: FeatureCheck[], group: FeatureCheck["group"]): string[] {
  const rows = checks.filter(function same(check) {
    return check.group === group;
  });
  if (rows.length === 0) {
    return [];
  }
  return [title, ...rows.map(function line(check) {
    return `${MARK[check.level]} ${check.message}`;
  }), ""];
}

export function formatFeatureStatus(assessments: FeatureAssessment[]): string {
  if (assessments.length === 0) {
    return "PromptMarket Features\n\nNo feature contracts.\nRun promptmarket feature init \"<goal>\" --project . --write\n";
  }
  const lines = ["PromptMarket Features", ""];
  for (const assessment of assessments) {
    const pattern = [assessment.pattern, assessment.guide].filter(function present(value): value is string {
      return Boolean(value);
    }).join(" · ");
    lines.push(assessment.id);
    if (pattern) {
      lines.push(pattern);
    }
    lines.push(
      "",
      ...section("Architecture", assessment.checks, "architecture"),
      ...section("Compatibility", assessment.checks, "compatibility"),
      ...section("Quality", assessment.checks, "quality"),
      ...section("Catalog", assessment.checks, "catalog"),
    );
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

export function formatFeatureSummary(assessments: FeatureAssessment[]): string {
  const lines = ["## PromptMarket", ""];
  if (assessments.length === 0) {
    lines.push("No feature contracts.", "");
    return `${lines.join("\n")}\n`;
  }
  for (const assessment of assessments) {
    lines.push(`Feature: ${assessment.id}`, "");
    for (const check of assessment.checks) {
      lines.push(`${MARK[check.level]} ${check.message}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function refreshFeature(
  current: FeatureContract,
  plan: ImplementationPlan,
  catalogVersion: string,
): FeatureRefresh {
  const next = contractFromPlan(plan, catalogVersion, current.id);
  next.ci = current.ci;
  next.implementation = current.implementation;
  next.project = {
    testedWith: next.project?.testedWith ?? {},
    ...(current.project?.unsupported ? { unsupported: current.project.unsupported } : {}),
  };
  if (Object.keys(next.project.testedWith).length === 0 && !next.project.unsupported) {
    delete next.project;
  }
  const lines = ["Changed since initialization", ""];
  const wrote: string[] = [];
  const held: string[] = [];
  const previousVerified = current.catalog.guideVerifiedAt ?? "unknown";
  const nextVerified = next.catalog.guideVerifiedAt ?? "unknown";
  if (previousVerified !== nextVerified) {
    lines.push("Guide verified", `${previousVerified} → ${nextVerified}`, "");
    wrote.push("catalog.guideVerifiedAt");
  }
  if (current.catalog.version !== catalogVersion) {
    wrote.push("catalog.version");
  }
  const before = current.project?.testedWith ?? {};
  const after = next.project?.testedWith ?? {};
  const packages = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const dependencyLines = packages.flatMap(function change(name) {
    if (before[name] === after[name]) {
      return [];
    }
    return [`${packageLabel(name)} ${before[name] ?? "none"} → ${after[name] ?? "removed"}`];
  });
  if (dependencyLines.length > 0) {
    lines.push("Dependencies", ...dependencyLines, "");
    wrote.push("project.testedWith");
  }
  if (current.guide && next.guide && current.guide !== next.guide) {
    held.push("guide");
    lines.push("Guide identity", `${current.guide} → ${next.guide}`, "Held. Refresh does not retarget the guide.", "");
    next.guide = current.guide;
    next.catalog.guideVerifiedAt = current.catalog.guideVerifiedAt;
    next.project = current.project;
    return {
      id: current.id,
      wrote: current.catalog.version === catalogVersion ? [] : ["catalog.version"],
      held,
      lines,
      next: {
        ...next,
        catalog: {
          ...current.catalog,
          version: catalogVersion,
        },
      },
    };
  }
  if (current.prompt && next.prompt && current.prompt !== next.prompt) {
    held.push("prompt");
    lines.push("Prompt identity", `${current.prompt} → ${next.prompt}`, "Held. Refresh does not retarget the prompt.", "");
    next.prompt = current.prompt;
  }
  if (plan.steps.length > 0) {
    lines.push("Implementation guidance");
    for (const step of plan.steps.slice(0, 8)) {
      lines.push(`- ${step.title}`);
    }
    lines.push("");
  }
  if (plan.verification.length > 0) {
    lines.push("Verification");
    for (const item of plan.verification) {
      lines.push(`+ ${item}`);
    }
    lines.push("");
  }
  if (wrote.length === 0) {
    lines.push("Metadata already matches the catalog.", "");
  }
  return { id: current.id, wrote, held, lines, next };
}

export function formatFeatureRefresh(refresh: FeatureRefresh, written: boolean): string {
  const tail = written
    ? ["Updated contract metadata.", ...refresh.wrote.map(function field(name) {
        return `  ${name}`;
      }), ""]
    : ["[No files changed]", ""];
  return `${[...refresh.lines, ...tail].join("\n")}\n`;
}

export type FeatureGuideContext = {
  docs: string[];
  verification: string[];
};

export type FeatureImpactStatus = "impacted" | "clear" | "unmapped";

export type FeatureImpact = {
  id: string;
  status: FeatureImpactStatus;
  changed: string[];
  checks: string[];
  docs: string[];
  suite?: string;
};

export type ChangeImpact = {
  changed: string[];
  features: FeatureImpact[];
};

export type FeatureReview = {
  id: string;
  risks: string[];
  recheck: string[];
  docs: string[];
};

const RISK_RULES: Array<{ label: string; test: (file: string) => boolean }> = [
  {
    label: "retrieval implementation changed",
    test: function retrieval(file) {
      return /(^|\/)(retrieval|retriever|rag|embed|embedding|embeddings|chunk|chunks)(\/|\.|$)/i.test(file);
    },
  },
  {
    label: "AI SDK route changed",
    test: function route(file) {
      return /\/api\//.test(file) && /route\.(ts|tsx|js|jsx)$/.test(file);
    },
  },
  {
    label: "schema changed",
    test: function schema(file) {
      return /(^|\/)schema\.(ts|prisma)$/.test(file) || /\/db\//.test(file);
    },
  },
  {
    label: "tool implementation changed",
    test: function tool(file) {
      return /(^|\/)tools?\//.test(file);
    },
  },
];

export function normalizePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of paths) {
    const value = entry.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (value.length === 0 || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

export function attachPaths(contract: FeatureContract, paths: string[]): FeatureContract {
  const next = normalizePaths([...(contract.implementation?.paths ?? []), ...paths]);
  if (next.length === 0) {
    throw new Error("Pass at least one --path glob.");
  }
  return {
    ...contract,
    implementation: { paths: next },
  };
}

export function pathMatches(pattern: string, file: string): boolean {
  const normalized = file.replace(/\\/g, "/").replace(/^\.\//, "");
  const source = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
  return picomatch(source, { dot: true })(normalized);
}

export function matchingPaths(paths: string[], files: string[]): string[] {
  return files.filter(function owned(file) {
    return paths.some(function matches(pattern) {
      return pathMatches(pattern, file);
    });
  });
}

function checklistName(pattern: string | undefined): string | undefined {
  if (!pattern) {
    return undefined;
  }
  if (pattern === "rag") {
    return "RAG verification checklist";
  }
  return `${pattern} verification checklist`;
}

function promptfooLabel(contract: FeatureContract): string | undefined {
  if (!contract.eval) {
    return undefined;
  }
  return `Promptfoo: ${contract.eval.suite.replace(/\/promptfooconfig\.yaml$/, "")}`;
}

function suiteId(contract: FeatureContract): string | undefined {
  if (!contract.eval) {
    return undefined;
  }
  const directory = contract.eval.suite.replace(/\/[^/]+$/, "");
  return directory.split("/").pop();
}

function recommendedChecks(contract: FeatureContract): string[] {
  const checks = [
    promptfooLabel(contract),
    "feature check",
    checklistName(contract.pattern),
  ].filter(function present(value): value is string {
    return Boolean(value);
  });
  return checks;
}

export type ChangeImpactOptions = {
  dependencyChanges?: DependencyChange[];
};

function contractFile(contract: FeatureContract): string {
  return `.promptmarket/features/${contract.id}.yaml`;
}

function suiteDirectory(suite: string): string {
  const normalized = suite.replace(/\\/g, "/").replace(/\/$/, "");
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? normalized : normalized.slice(0, slash);
}

function implicitMatches(contract: FeatureContract, files: string[]): string[] {
  const contractPath = contractFile(contract);
  const suite = contract.eval?.suite.replace(/\\/g, "/");
  const directory = suite ? suiteDirectory(suite) : undefined;
  return files.filter(function hit(file) {
    if (file === contractPath) {
      return true;
    }
    if (!suite || !directory) {
      return false;
    }
    return file === suite || file.startsWith(`${directory}/`);
  });
}

function relevantDependencyChanges(
  contract: FeatureContract,
  changes: DependencyChange[],
): DependencyChange[] {
  const tested = contract.project?.testedWith ?? {};
  return changes.filter(function used(change) {
    return Object.prototype.hasOwnProperty.call(tested, change.packageName);
  });
}

export function assessChangeImpact(
  contracts: FeatureContract[],
  changedFiles: string[],
  guides: Record<string, FeatureGuideContext> = {},
  options: ChangeImpactOptions = {},
): ChangeImpact {
  const changed = normalizePaths(changedFiles);
  const dependencies = options.dependencyChanges ?? [];
  const features = contracts.map(function impact(contract) {
    const paths = contract.implementation?.paths ?? [];
    const docs = guides[contract.id]?.docs ?? [];
    const owned = matchingPaths(paths, changed);
    const implicit = implicitMatches(contract, changed).filter(function extra(file) {
      return !owned.includes(file);
    });
    const dependencyHits = relevantDependencyChanges(contract, dependencies);
    const reasons = [
      ...owned,
      ...implicit,
      ...dependencyHits.map(formatDependencyChange),
    ];
    if (reasons.length === 0) {
      if (paths.length === 0) {
        const unmapped: FeatureImpact = {
          id: contract.id,
          status: "unmapped",
          changed: [],
          checks: [],
          docs,
        };
        return unmapped;
      }
      const clear: FeatureImpact = {
        id: contract.id,
        status: "clear",
        changed: [],
        checks: [],
        docs: [],
      };
      return clear;
    }
    const suite = suiteId(contract);
    const hit: FeatureImpact = {
      id: contract.id,
      status: "impacted",
      changed: reasons,
      checks: recommendedChecks(contract),
      docs,
      ...(suite ? { suite } : {}),
    };
    return hit;
  });
  return { changed, features };
}

function riskLabels(files: string[]): string[] {
  const labels: string[] = [];
  for (const rule of RISK_RULES) {
    if (files.some(rule.test)) {
      labels.push(rule.label);
    }
  }
  const unlabeled = files.filter(function unmatched(file) {
    return !RISK_RULES.some(function rule(item) {
      return item.test(file);
    });
  });
  for (const file of unlabeled) {
    labels.push(`owned path changed: ${file}`);
  }
  return labels;
}

function implicitRisks(files: string[]): string[] {
  const labels: string[] = [];
  if (files.some(function contract(file) {
    return file.startsWith(".promptmarket/features/") && file.endsWith(".yaml");
  })) {
    labels.push("feature contract changed");
  }
  if (files.some(function suite(file) {
    return file.startsWith(".promptmarket/evals/");
  })) {
    labels.push("eval suite changed");
  }
  return labels;
}

function dependencyRisks(changes: DependencyChange[]): string[] {
  return changes.map(function risk(change) {
    const from = change.from.length > 0 ? change.from : "absent";
    const to = change.to.length > 0 ? change.to : "absent";
    return `dependency version changed: ${packageLabel(change.packageName)} ${from} → ${to}`;
  });
}

export function reviewFeatureChange(
  contract: FeatureContract,
  changedFiles: string[],
  guide?: FeatureGuideContext,
  dependencyChanges: DependencyChange[] = [],
): FeatureReview {
  const files = normalizePaths(changedFiles);
  const owned = matchingPaths(contract.implementation?.paths ?? [], files);
  const implicit = implicitMatches(contract, files);
  const dependencies = relevantDependencyChanges(contract, dependencyChanges);
  const promptfoo = contract.eval
    ? `Promptfoo ${contract.pattern === "rag" ? "RAG" : contract.pattern ?? "feature"} suite`
    : undefined;
  return {
    id: contract.id,
    risks: [...dependencyRisks(dependencies), ...riskLabels(owned), ...implicitRisks(implicit)],
    recheck: [...(guide?.verification ?? []), ...(promptfoo ? [promptfoo] : [])],
    docs: guide?.docs ?? [],
  };
}

export function formatChangeImpact(impact: ChangeImpact): string {
  const lines = ["PromptMarket Change Impact", ""];
  const impacted = impact.features.filter(function hit(feature) {
    return feature.status === "impacted";
  });
  const clear = impact.features.filter(function miss(feature) {
    return feature.status === "clear";
  });
  const unmapped = impact.features.filter(function open(feature) {
    return feature.status === "unmapped";
  });
  if (impacted.length === 0 && clear.length === 0 && unmapped.length === 0) {
    lines.push("No feature contracts.", "");
    return `${lines.join("\n")}\n`;
  }
  for (const feature of impacted) {
    lines.push(feature.id, "Impacted", "", "Changed");
    for (const file of feature.changed) {
      lines.push(`✓ ${file}`);
    }
    lines.push("", "Recommended checks");
    for (const check of feature.checks) {
      lines.push(`→ ${check}`);
    }
    if (feature.docs.length > 0) {
      lines.push("", "Docs to re-check");
      for (const doc of feature.docs) {
        lines.push(`→ ${doc}`);
      }
    }
    lines.push("");
  }
  if (clear.length > 0) {
    lines.push("Not impacted", ...clear.map(function name(feature) {
      return feature.id;
    }), "");
  }
  if (unmapped.length > 0) {
    lines.push(
      "No ownership map",
      ...unmapped.map(function name(feature) {
        return `${feature.id}`;
      }),
      "Attach paths with promptmarket feature attach <id> --path \"<glob>\" --write",
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

export function formatChangeSummary(impact: ChangeImpact): string {
  const lines = ["## PromptMarket", ""];
  lines.push(`${impact.features.length} AI features`, "");
  for (const feature of impact.features) {
    if (feature.status === "impacted") {
      lines.push(`### ${feature.id} — impacted`, "", "Changed:");
      for (const file of feature.changed) {
        lines.push(`- ${file}`);
      }
      lines.push("");
      for (const check of feature.checks) {
        lines.push(`→ ${check}`);
      }
      lines.push("");
      continue;
    }
    const label = feature.status === "clear" ? "not impacted" : "no ownership map";
    lines.push(`### ${feature.id} — ${label}`, "");
  }
  return `${lines.join("\n")}\n`;
}

export function formatFeatureReviews(reviews: FeatureReview[]): string {
  if (reviews.length === 0) {
    return "PromptMarket Feature Review\n\nNo impacted feature contracts.\n";
  }
  const lines = ["PromptMarket Feature Review", ""];
  for (const review of reviews) {
    lines.push(review.id, "", "Risk areas");
    if (review.risks.length === 0) {
      lines.push("- none");
    } else {
      for (const risk of review.risks) {
        lines.push(`- ${risk}`);
      }
    }
    lines.push("", "Re-check");
    review.recheck.forEach(function item(entry, index) {
      lines.push(`${index + 1}. ${entry}`);
    });
    if (review.docs.length > 0) {
      lines.push("", "Current documentation targets");
      for (const doc of review.docs) {
        lines.push(`- ${doc}`);
      }
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
