export type RetrievalCase = {
  query: string;
  expectedGuide?: string;
  expectedTopic?: string;
  expectedPrompt?: string;
  /** Natural phrasing is scored at top-3. Lexical phrasing is scored at top-1. */
  rank: "top1" | "top3";
};

export const retrievalCases: RetrievalCase[] = [
  {
    query: "I need my app to answer questions from company documents",
    expectedGuide: "rag-knowledge-base",
    expectedTopic: "rag",
    expectedPrompt: "rag-grounded-answer",
    rank: "top3",
  },
  {
    query: "let the model create tasks in my database",
    expectedGuide: "ai-project-manager-convex",
    expectedPrompt: "safe-tool-calling-system",
    rank: "top3",
  },
  {
    query: "teach me Convex tool calling",
    expectedGuide: "ai-project-manager-convex",
    expectedTopic: "tool-calling",
    expectedPrompt: "safe-tool-calling-system",
    rank: "top3",
  },
  {
    query: "return typed JSON from the model",
    expectedGuide: "ai-product-brief-builder",
    expectedTopic: "structured-outputs",
    expectedPrompt: "json-output-system",
    rank: "top3",
  },
  {
    query: "RAG",
    expectedGuide: "rag-knowledge-base",
    expectedTopic: "rag",
    expectedPrompt: "rag-grounded-answer",
    rank: "top1",
  },
  {
    query: "retrieval augmented generation",
    expectedTopic: "rag",
    expectedGuide: "rag-knowledge-base",
    rank: "top1",
  },
  {
    query: "rag grounded answer",
    expectedPrompt: "rag-grounded-answer",
    rank: "top1",
  },
  {
    query: "answer with citations",
    expectedPrompt: "answer-with-citations",
    rank: "top1",
  },
  {
    query: "search query rewriter",
    expectedPrompt: "search-query-rewriter",
    rank: "top1",
  },
  {
    query: "tool calling",
    expectedTopic: "tool-calling",
    expectedGuide: "ai-project-manager-convex",
    rank: "top1",
  },
  {
    query: "Convex tool calling",
    expectedGuide: "ai-project-manager-convex",
    expectedTopic: "tool-calling",
    rank: "top1",
  },
  {
    query: "safe tool calling system",
    expectedPrompt: "safe-tool-calling-system",
    expectedGuide: "ai-project-manager-convex",
    rank: "top1",
  },
  {
    query: "tool selection router",
    expectedPrompt: "tool-selection-router",
    expectedTopic: "tool-calling",
    rank: "top1",
  },
  {
    query: "structured outputs",
    expectedTopic: "structured-outputs",
    expectedGuide: "ai-product-brief-builder",
    rank: "top1",
  },
  {
    query: "structured data extractor",
    expectedPrompt: "structured-data-extractor",
    expectedTopic: "structured-data",
    rank: "top1",
  },
  {
    query: "json output system",
    expectedPrompt: "json-output-system",
    rank: "top1",
  },
  {
    query: "product brief",
    expectedGuide: "ai-product-brief-builder",
    rank: "top1",
  },
  {
    query: "agentic loops",
    expectedTopic: "agentic-loops",
    rank: "top1",
  },
  {
    query: "what are agents",
    expectedTopic: "agents",
    rank: "top1",
  },
  {
    query: "evals",
    expectedTopic: "evals",
    rank: "top1",
  },
  {
    query: "classification",
    expectedTopic: "classification",
    rank: "top1",
  },
  {
    query: "summarization",
    expectedTopic: "summarization",
    rank: "top1",
  },
  {
    query: "document classifier",
    expectedPrompt: "document-classifier",
    expectedTopic: "classification",
    rank: "top1",
  },
  {
    query: "content moderation classifier",
    expectedPrompt: "content-moderation-classifier",
    rank: "top1",
  },
  {
    query: "meeting summarizer",
    expectedPrompt: "meeting-summarizer",
    rank: "top1",
  },
  {
    query: "support ticket triage",
    expectedPrompt: "support-ticket-triage",
    rank: "top1",
  },
  {
    query: "question answering",
    expectedTopic: "question-answering",
    rank: "top1",
  },
  {
    query: "workflows",
    expectedTopic: "workflows",
    rank: "top1",
  },
  {
    query: "pgvector cosine similarity",
    expectedGuide: "rag-knowledge-base",
    rank: "top1",
  },
];
