export {
  compatibilityFor,
  doctorGuides,
  packageLabel,
  versionsMatch,
  type CompatibilityItem,
  type CompatibilityStatus,
  type DoctorGuide,
} from "./compatibility.js";
export {
  buildContext,
  detectContextMode,
  CONTENT_ORIGIN,
  type BuildContextOptions,
  type BuiltContext,
  type ContextDetail,
  type ContextMode,
  type ContextGuide,
  type ContextMatch,
  type ContextNextStep,
  type ContextPrompt,
  type ProjectNote,
  type ProjectNoteStatus,
  type RelatedItem,
  type ContextSkill,
  type ContextSkillInput,
  type ContextTopic,
} from "./context.js";
export { handleContentRequest } from "./content-http.js";
export {
  formatAgentContext,
  formatCompatibility,
  formatContextText,
  formatNotes,
  formatPlan,
} from "./format.js";
export { contentMeta, contentVersionOf, type ContentMeta } from "./meta.js";
export {
  detectProject,
  otherProjectLabels,
  parseProjectContext,
  projectStackLabels,
  type ProjectContext,
} from "./project.js";
export { createContentCatalog } from "./load.js";
export { ContentError, ContentNotFoundError } from "./errors.js";
export {
  categoryLabel,
  difficultyLabel,
  loadContentCatalog,
  moduleTitle,
  rankContent,
  resolveContentDir,
  summarizePrompt,
  type ContentCatalog,
} from "./load.js";
export { detectPlaceholders } from "./placeholders.js";
export {
  buildPlan,
  type BuildPlanOptions,
  type ImplementationPlan,
  type CuratedReference,
  debugTargetsFor,
  observabilityTargetsFor,
  DEVTOOLS_COMMAND,
  DEVTOOLS_WARNING,
  usesAiSdk,
  type DocumentationTarget,
  type EvidenceTargets,
  type PlanReference,
  type PlanStep,
} from "./plan.js";
export { rankItems, tokenize, type Ranked } from "./search.js";
export {
  CATEGORY_LABELS,
  DIAGRAMS,
  DIFFICULTIES,
  MODULES,
  PROMPT_CATEGORIES,
  type DiagramId,
  type Difficulty,
  type DebugTarget,
  type EvalKind,
  type ObservabilityProvider,
  type ObservabilityTarget,
  type EvalTarget,
  type Guide,
  type GuideDocTarget,
  type GuideEval,
  type GuideEvalCase,
  type GuideEvidence,
  type GuideSection,
  type GuideSourceReference,
  type GuideSummary,
  type LearnSummary,
  type LearnTopic,
  type ModuleId,
  type PromptCategory,
  type PromptDocument,
  type PromptSummary,
  type Recommendation,
  type SearchFields,
} from "./types.js";
export { assertDistinctSlugs } from "./load.js";
