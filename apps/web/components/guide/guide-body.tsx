import { CommandBlock } from "../command-block";
import { parseGuideMarkdown, type InlineNode } from "../../lib/guide-markdown";
import { Callout, Checkpoint } from "./callout";
import { CodeBlock } from "./code-block";
import { EnvironmentVariables } from "./environment-variables";
import { FileBlock } from "./file-block";

interface GuideBodyProps {
  markdown: string;
}

function Inline({ node }: { node: InlineNode }) {
  if (node.type === "code") {
    return <code>{node.text}</code>;
  }
  if (node.type === "strong") {
    return (
      <strong>
        {node.children.map(function renderChild(child, childIndex) {
          return <Inline key={`${child.type}-${childIndex}`} node={child} />;
        })}
      </strong>
    );
  }
  if (node.type === "link") {
    const external = node.href.startsWith("http");
    return (
      <a href={node.href} rel={external ? "noreferrer" : undefined}>
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

export function GuideBody({ markdown }: GuideBodyProps) {
  const blocks = parseGuideMarkdown(markdown);
  return (
    <div className="guide-body">
      {blocks.map(function renderBlock(block, index) {
        if (block.type === "heading") {
          if (block.level === 3) {
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
        if (block.type === "callout") {
          const body = <Inlines nodes={block.inlines} />;
          if (block.kind === "checkpoint") {
            return <Checkpoint key={index}>{body}</Checkpoint>;
          }
          return (
            <Callout key={index} kind={block.kind}>
              {body}
            </Callout>
          );
        }
        if (block.type === "code") {
          const language = block.language.toLowerCase();
          if (language === "bash" || language === "sh") {
            return (
              <CommandBlock
                key={index}
                command={block.text}
                label="Copy command"
              />
            );
          }
          if (language === "env" && block.filename) {
            return (
              <EnvironmentVariables
                key={index}
                filename={block.filename}
                value={block.text}
              />
            );
          }
          if (block.filename) {
            return (
              <FileBlock
                key={index}
                filename={block.filename}
                code={block.text}
              />
            );
          }
          return <CodeBlock key={index} code={block.text} label={language} />;
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
