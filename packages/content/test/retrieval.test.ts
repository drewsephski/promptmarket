import { describe, expect, test } from "vitest";
import { buildContext, loadContentCatalog } from "../src/index.js";
import { retrievalCases } from "./retrieval-cases.js";

const TOP_K = 3;

describe("retrieval evals", function retrievalEvals() {
  test("keeps top-1 and top-3 accuracy above the baseline", function scoresRetrieval() {
    const catalog = loadContentCatalog();
    const totals = { guide: 0, topic: 0, prompt: 0 };
    const top1 = { guide: 0, topic: 0, prompt: 0 };
    const top3 = { guide: 0, topic: 0, prompt: 0 };
    const misses: string[] = [];

    for (const item of retrievalCases) {
      const context = buildContext(catalog, { query: item.query, maxItems: TOP_K });
      const checks: Array<["guide" | "topic" | "prompt", string | undefined, string[]]> = [
        [
          "guide",
          item.expectedGuide,
          context.guides.map(function slugOf(guide) {
            return guide.slug;
          }),
        ],
        [
          "topic",
          item.expectedTopic,
          context.topics.map(function slugOf(topic) {
            return topic.slug;
          }),
        ],
        [
          "prompt",
          item.expectedPrompt,
          context.prompts.map(function nameOf(prompt) {
            return prompt.name;
          }),
        ],
      ];
      for (const [kind, expected, actual] of checks) {
        if (!expected) {
          continue;
        }
        totals[kind] += 1;
        const at = actual.indexOf(expected);
        const limit = item.rank === "top1" ? 1 : TOP_K;
        if (at === 0) {
          top1[kind] += 1;
          top3[kind] += 1;
        } else if (at >= 0 && at < TOP_K) {
          top3[kind] += 1;
          if (limit === 1) {
            misses.push(`${kind} top1 ${item.query} → ${actual[0]} expected ${expected}`);
          }
        } else {
          misses.push(
            `${kind} miss ${item.query} → ${actual.join(", ")} expected ${expected}`,
          );
        }
      }
    }

    function rate(hits: number, total: number): number {
      return total === 0 ? 1 : hits / total;
    }

    const guideTop1 = rate(top1.guide, totals.guide);
    const topicTop1 = rate(top1.topic, totals.topic);
    const promptTop1 = rate(top1.prompt, totals.prompt);
    const guideTop3 = rate(top3.guide, totals.guide);
    const topicTop3 = rate(top3.topic, totals.topic);
    const promptTop3 = rate(top3.prompt, totals.prompt);

    expect(retrievalCases.length).toBeGreaterThanOrEqual(25);
    expect(misses, misses.join("\n")).toEqual([]);
    expect(guideTop1).toBeGreaterThan(0);
    expect(topicTop1).toBeGreaterThan(0);
    expect(promptTop1).toBeGreaterThan(0);
    expect(guideTop3).toBe(1);
    expect(topicTop3).toBe(1);
    expect(promptTop3).toBe(1);
  });
});