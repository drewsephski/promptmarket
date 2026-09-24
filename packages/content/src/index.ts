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
  CONTENT_ORIGIN,
  type BuildContextOptions,
  type BuiltContext,
  type ContextDetail,
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
export { rankItems, tokenize, type Ranked } from "./search.js";
export {
  CATEGORY_LABELS,
  DIAGRAMS,
  DIFFICULTIES,
  MODULES,
  PROMPT_CATEGORIES,
  type DiagramId,
  type Difficulty,
  type Guide,
  type GuideSection,
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
