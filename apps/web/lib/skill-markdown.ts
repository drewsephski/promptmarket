export type InlineNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; text: string }
  | { type: "link"; text: string; href: string };

export type SkillBlock =
  | { type: "heading"; level: 1 | 2 | 3; inlines: InlineNode[] }
  | { type: "paragraph"; inlines: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "code"; text: string };

function parseInlines(input: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let cursor = 0;
  for (const match of input.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push({ type: "text", text: input.slice(cursor, index) });
    }
    if (match[1]) {
      nodes.push({ type: "code", text: match[1].slice(1, -1) });
    } else if (match[2]) {
      nodes.push({ type: "strong", text: match[2].slice(2, -2) });
    } else if (match[4] && match[5]) {
      nodes.push({ type: "link", text: match[4], href: match[5] });
    }
    cursor = index + match[0].length;
  }
  if (cursor < input.length) {
    nodes.push({ type: "text", text: input.slice(cursor) });
  }
  return nodes.length > 0 ? nodes : [{ type: "text", text: input }];
}

export function parseSkillMarkdown(source: string): SkillBlock[] {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const blocks: SkillBlock[] = [];
  let index = 0;

  function pushParagraph(text: string): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    blocks.push({ type: "paragraph", inlines: parseInlines(trimmed) });
  }

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading?.[1] && heading[2]) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        inlines: parseInlines(heading[2].trim()),
      });
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line) || /^[-*]\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: InlineNode[][] = [];
      while (index < lines.length) {
        const item = lines[index] ?? "";
        const marker = ordered
          ? /^\d+\.\s+(.+)$/.exec(item)
          : /^[-*]\s+(.+)$/.exec(item);
        if (!marker?.[1]) {
          break;
        }
        items.push(parseInlines(marker[1].trim()));
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (
        current.trim().length === 0 ||
        current.startsWith("```") ||
        /^(#{1,3})\s+/.test(current) ||
        /^\d+\.\s+/.test(current) ||
        /^[-*]\s+/.test(current)
      ) {
        break;
      }
      paragraph.push(current.trim());
      index += 1;
    }
    pushParagraph(paragraph.join(" "));
  }

  return blocks;
}
