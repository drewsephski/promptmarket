import { parse, stringify } from "yaml";

export type LangfuseDatasetItem = {
  id?: string;
  status?: string;
  input?: unknown;
  expectedOutput?: unknown;
  sourceTraceId?: string;
  sourceObservationId?: string;
};

export type ProductionCase = {
  description: string;
  vars: { input: string };
  assert: Array<{ type: string; value?: string }>;
  metadata?: {
    sourceTraceId?: string;
    sourceObservationId?: string;
    datasetItemId?: string;
  };
};

function inputText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  return JSON.stringify(value);
}

function expectationText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export function productionCases(items: LangfuseDatasetItem[]): {
  cases: ProductionCase[];
  skipped: number;
} {
  const cases: ProductionCase[] = [];
  let skipped = 0;
  for (const item of items) {
    if (item.status === "ARCHIVED") {
      skipped += 1;
      continue;
    }
    if (item.expectedOutput === undefined || item.expectedOutput === null) {
      skipped += 1;
      continue;
    }
    const expected = expectationText(item.expectedOutput);
    const asserts: ProductionCase["assert"] =
      typeof item.expectedOutput === "string"
        ? [{ type: "equals", value: expected }]
        : [
            { type: "is-json" },
            {
              type: "llm-rubric",
              value: `Match this curated expected behavior: ${expected}`,
            },
          ];
    cases.push({
      description: item.sourceTraceId
        ? `production ${item.sourceTraceId}`
        : `production ${item.id ?? cases.length + 1}`,
      vars: { input: inputText(item.input) },
      assert: asserts,
      metadata: {
        ...(item.id ? { datasetItemId: item.id } : {}),
        ...(item.sourceTraceId ? { sourceTraceId: item.sourceTraceId } : {}),
        ...(item.sourceObservationId
          ? { sourceObservationId: item.sourceObservationId }
          : {}),
      },
    });
  }
  return { cases, skipped };
}

export function productionCasesYaml(cases: ProductionCase[]): string {
  return stringify(cases);
}

export function includeProductionCases(config: string): string {
  const parsed: unknown = parse(config);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return config;
  }
  const document = parsed as Record<string, unknown>;
  const current = document.tests;
  const entry = "file://production-cases.yaml";
  if (current === entry) {
    return config;
  }
  if (typeof current === "string") {
    document.tests = [current, entry];
  } else if (Array.isArray(current)) {
    if (!current.includes(entry)) {
      current.push(entry);
    }
  } else {
    document.tests = [entry];
  }
  return stringify(document);
}

type DatasetPage = {
  data?: LangfuseDatasetItem[];
  meta?: {
    page?: number;
    totalPages?: number;
  };
};

export async function listDatasetItems(
  dataset: string,
  options: {
    publicKey: string;
    secretKey: string;
    baseUrl: string;
    fetch: typeof fetch;
  },
): Promise<LangfuseDatasetItem[]> {
  const items: LangfuseDatasetItem[] = [];
  let page = 1;
  for (;;) {
    const url = new URL("/api/public/dataset-items", options.baseUrl);
    url.searchParams.set("datasetName", dataset);
    url.searchParams.set("page", String(page));
    const response = await options.fetch(url, {
      headers: {
        authorization: `Basic ${Buffer.from(`${options.publicKey}:${options.secretKey}`).toString("base64")}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Langfuse dataset ${dataset} returned ${response.status}. Sync only reads curated dataset items.`,
      );
    }
    const body = (await response.json()) as DatasetPage;
    items.push(...(body.data ?? []));
    const total = body.meta?.totalPages ?? 1;
    if (page >= total) {
      return items;
    }
    page += 1;
  }
}
