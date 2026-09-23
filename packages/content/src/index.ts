export { ContentError, ContentNotFoundError } from "./errors.js";
export {
  categoryLabel,
  difficultyLabel,
  loadContentCatalog,
  moduleTitle,
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
