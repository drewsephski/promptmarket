export type InlineNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "link"; text: string; href: string };

export type CalloutKind = "checkpoint" | "note" | "warning";

export type GuideBlock =
  | { type: "heading"; level: 3 | 4; inlines: InlineNode[] }
  | { type: "paragraph"; inlines: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "code"; language: string; filename?: string; text: string }
  | { type: "callout"; kind: CalloutKind; inlines: InlineNode[] };

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[([^\]\n]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\))/g;

function parseInlines(input: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;
  for (const match of input.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push({ type: "text", text: input.slice(cursor, index) });
    }
    if (match[1]) {
      nodes.push({ type: "code", text: match[1].slice(1, -1) });
    } else if (match[2]) {
      nodes.push({
        type: "strong",
        children: parseInlines(match[2].slice(2, -2)),
      });
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

function calloutKind(text: string): CalloutKind | undefined {
  const label = /^\*\*(Checkpoint|Note|Warning):\*\*/.exec(text.trim());
  const name = label?.[1]?.toLowerCase();
  if (name === "checkpoint" || name === "note" || name === "warning") {
    return name;
  }
  return undefined;
}

function fenceInfo(info: string): { language: string; filename?: string } {
  const [language, ...rest] = info.trim().split(/\s+/);
  const filename = rest.join(" ").trim();
  return {
    language: language ?? "",
    filename: filename.length > 0 ? filename : undefined,
  };
}

export function parseGuideMarkdown(source: string): GuideBlock[] {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const blocks: GuideBlock[] = [];
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
      const info = fenceInfo(line.slice(3));
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push({
        type: "code",
        language: info.language,
        filename: info.filename,
        text: code.join("\n"),
      });
      continue;
    }

    if (line.startsWith(">")) {
      const quoted: string[] = [];
      while (index < lines.length && (lines[index] ?? "").startsWith(">")) {
        quoted.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      const text = quoted.join(" ").trim();
      const kind = calloutKind(text) ?? "note";
      const body = text
        .replace(/^\*\*(Checkpoint|Note|Warning):\*\*\s*/, "")
        .trim();
      blocks.push({
        type: "callout",
        kind,
        inlines: parseInlines(body.length > 0 ? body : text),
      });
      continue;
    }

    const heading = /^(#{3,4})\s+(.+)$/.exec(line);
    if (heading?.[1] && heading[2]) {
      blocks.push({
        type: "heading",
        level: heading[1].length === 3 ? 3 : 4,
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
        current.startsWith(">") ||
        /^#{3,4}\s+/.test(current) ||
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
