import type { SearchFields } from "./types.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "for",
  "and",
  "or",
  "in",
  "on",
  "with",
  "my",
  "i",
  "me",
  "from",
  "into",
  "your",
  "you",
  "it",
  "is",
  "are",
  "be",
  "how",
  "what",
  "when",
  "do",
  "does",
  "need",
  "want",
  "please",
  "help",
  "give",
  "explain",
  "about",
  "this",
  "that",
  "app",
  "adding",
  "using",
  "use",
  "make",
  "making",
  "can",
  "im",
  "i'm",
]);

export function tokenize(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(function keep(token) {
      return token.length > 1 && !STOP_WORDS.has(token);
    });
  return [...new Set(tokens)];
}

export type Ranked<T> = {
  item: T;
  score: number;
  matchedAll: boolean;
};

export function rankItems<T>(
  query: string,
  items: readonly T[],
  fieldsOf: (item: T) => SearchFields,
): Ranked<T>[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return items.map(function identity(item) {
      return { item, score: 0, matchedAll: true };
    });
  }

  const ranked: Ranked<T>[] = [];
  for (const item of items) {
    const fields = fieldsOf(item);
    const weighted: Array<[string, number]> = [
      [fields.title, 6],
      [fields.category ?? "", 5],
      [(fields.tags ?? []).join(" "), 4],
      [fields.description, 3],
      [(fields.extra ?? []).join(" "), 3],
      [fields.body ?? "", 1],
    ];
    let score = 0;
    let matched = 0;
    for (const token of tokens) {
      let best = 0;
      for (const [text, weight] of weighted) {
        if (text.toLowerCase().includes(token)) {
          best = Math.max(best, weight);
        }
      }
      if (best > 0) {
        matched += 1;
        score += best;
      }
    }
    if (matched === 0) {
      continue;
    }
    const title = fields.title.toLowerCase();
    if (
      tokens.every(function inTitle(token) {
        return title.includes(token);
      })
    ) {
      score += 8;
    }
    ranked.push({
      item,
      score,
      matchedAll: matched === tokens.length,
    });
  }

  ranked.sort(function byScore(left, right) {
    if (left.matchedAll !== right.matchedAll) {
      return left.matchedAll ? -1 : 1;
    }
    return right.score - left.score;
  });
  return ranked;
}
