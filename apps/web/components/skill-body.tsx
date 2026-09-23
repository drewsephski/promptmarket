import { parseSkillMarkdown, type InlineNode } from "../lib/skill-markdown";

interface SkillBodyProps {
  markdown: string;
}

function Inline({ node }: { node: InlineNode }) {
  if (node.type === "code") {
    return <code>{node.text}</code>;
  }
  if (node.type === "strong") {
    return <strong>{node.text}</strong>;
  }
  if (node.type === "link") {
    return (
      <a href={node.href} rel="noreferrer">
        {node.text}
      </a>
    );
  }
  return node.text;
}

function Inlines({ nodes }: { nodes: InlineNode[] }) {
  return nodes.map(function renderInline(node, index) {
    return <Inline key={`${node.type}-${index}`} node={node} />;
  });
}

export function SkillBody({ markdown }: SkillBodyProps) {
  const blocks = parseSkillMarkdown(markdown);
  return (
    <div className="skill">
      {blocks.map(function renderBlock(block, index) {
        if (block.type === "heading") {
          if (block.level === 1) {
            return (
              <h2 key={index}>
                <Inlines nodes={block.inlines} />
              </h2>
            );
          }
          if (block.level === 2) {
            return (
              <h3 key={index}>
                <Inlines nodes={block.inlines} />
              </h3>
            );
          }
          return (
            <h4 key={index}>
              <Inlines nodes={block.inlines} />
            </h4>
          );
        }
        if (block.type === "list") {
          const items = block.items.map(function renderItem(item, itemIndex) {
            return (
              <li key={itemIndex}>
                <Inlines nodes={item} />
              </li>
            );
          });
          if (block.ordered) {
            return <ol key={index}>{items}</ol>;
          }
          return <ul key={index}>{items}</ul>;
        }
        if (block.type === "code") {
          return (
            <pre key={index}>
              <code>{block.text}</code>
            </pre>
          );
        }
        return (
          <p key={index}>
            <Inlines nodes={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}
