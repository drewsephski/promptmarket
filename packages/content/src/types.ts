export const MODULES = [
  {
    id: "uses",
    title: "What LLMs are good at",
    description: "Start from a job the model can actually do.",
  },
  {
    id: "prompting",
    title: "Prompting fundamentals",
    description:
      "Instructions, context, examples, and the shape of the answer.",
  },
  {
    id: "patterns",
    title: "Application patterns",
    description: "The usual ways an AI feature is assembled.",
  },
  {
    id: "reliability",
    title: "Building reliable AI",
    description: "Treat model behavior as something you measure.",
  },
  {
    id: "optimization",
    title: "Optimization",
    description: "Add complexity only after the simpler version fails.",
  },
  {
    id: "products",
    title: "Building AI products",
    description: "A short loop from a useful problem to a better system.",
  },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];

export const PROMPT_CATEGORIES = [
  "extraction",
  "classification",
  "structured-output",
  "rag",
  "tool-calling",
  "agents",
  "summarization",
  "transformation",
  "search",
  "support",
  "moderation",
  "evaluation",
  "coding",
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<PromptCategory, string> = {
  extraction: "Extraction",
  classification: "Classification",
  "structured-output": "Structured output",
  rag: "RAG",
  "tool-calling": "Tool calling",
  agents: "Agents",
  summarization: "Summarization",
  transformation: "Transformation",
  search: "Search",
  support: "Support",
  moderation: "Moderation",
  evaluation: "Evaluation",
  coding: "Coding",
};

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIAGRAMS = [
  "extract",
  "rag",
  "agent",
  "tools",
  "workflow",
  "eval",
  "ladder",
] as const;

export type DiagramId = (typeof DIAGRAMS)[number];

export type LearnSections = {
  example: string;
  implementationNotes: string;
  commonMistakes: string;
};

export type LearnTopic = {
  slug: string;
  title: string;
  module: ModuleId;
  order: number;
  summary: string;
  definition: string;
  mentalModel: string;
  why: string;
  whenToUse: string[];
  whenNotToUse: string[];
  diagram?: DiagramId;
  sections: LearnSections;
  relatedPrompts: string[];
  relatedTopics: string[];
  href: string;
};

export type PromptDocument = {
  slug: string;
  title: string;
  description: string;
  category: PromptCategory;
  tags: string[];
  difficulty: Difficulty;
  whenToUse: string;
  whyItWorks: string;
  commonMistakes: string[];
  relatedTopics: string[];
  relatedPrompts: string[];
  exampleInput?: string;
  exampleOutput?: string;
  body: string;
  variables: string[];
  href: string;
};

export type LearnSummary = {
  slug: string;
  title: string;
  module: ModuleId;
  summary: string;
  href: string;
};

export type PromptSummary = {
  name: string;
  title: string;
  description: string;
  category: PromptCategory;
  tags: string[];
  difficulty: Difficulty;
  href: string;
};

export type SearchFields = {
  title: string;
  description: string;
  category?: string;
  tags?: string[];
  extra?: string[];
  body?: string;
};

export type Recommendation = {
  recommendation: PromptSummary | null;
  alternatives: PromptSummary[];
};

export type GuideSection = {
  id: string;
  title: string;
  markdown: string;
};

export type Guide = {
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  stack: string[];
  concepts: string[];
  estimatedTime?: string;
  order?: number;
  prerequisites: string[];
  whatYouBuild: string[];
  whatYouLearn: string[];
  architecture: string[];
  relatedTopics: string[];
  relatedPrompts: string[];
  sections: GuideSection[];
  href: string;
};

export type GuideSummary = {
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  stack: string[];
  concepts: string[];
  estimatedTime?: string;
  href: string;
};
