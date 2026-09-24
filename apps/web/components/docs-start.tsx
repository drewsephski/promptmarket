"use client";

import { useState } from "react";
import { CommandBlock } from "./command-block";
import { HOSTED_MCP_URL } from "../lib/present";
import { useTabKeyboard } from "../lib/use-tab-keyboard";

const CURSOR_COMMAND =
  "pnpm dlx @promptmarket/cli setup cursor --write --with-context7";

const CLI_COMMANDS = `pnpm dlx @promptmarket/cli context "add RAG over our documentation" --project . --format agent
pnpm dlx @promptmarket/cli plan "add RAG over our documentation" --project .
pnpm dlx @promptmarket/cli feature status`;

const choices = [
  { id: "cursor", label: "Cursor", note: "Recommended" },
  { id: "cli", label: "CLI", note: "" },
  { id: "mcp", label: "MCP", note: "" },
  { id: "web", label: "Web", note: "" },
] as const;

type ChoiceId = (typeof choices)[number]["id"];

export function DocsStart() {
  const [choice, setChoice] = useState<ChoiceId>("cursor");

  function handleChoice(id: ChoiceId) {
    setChoice(id);
  }

  const choiceIds = choices.map(function idOf(item) {
    return item.id;
  });
  const handleChoiceKeys = useTabKeyboard(
    choiceIds,
    choice,
    handleChoice,
    function docsTabId(id) {
      return `docs-${id}`;
    },
  );

  return (
    <section
      className="docs-start"
      id="cursor"
      aria-label="How to use PromptMarket"
    >
      <div
        className="docs-choices"
        role="tablist"
        aria-label="Install options"
        onKeyDown={handleChoiceKeys}
      >
        {choices.map(function renderChoice(item) {
          const selected = choice === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`docs-${item.id}`}
              aria-controls="docs-choice-panel"
              tabIndex={selected ? 0 : -1}
              onClick={function onChoice() {
                handleChoice(item.id);
              }}
            >
              <strong>{item.label}</strong>
              {item.note ? <span>{item.note}</span> : null}
            </button>
          );
        })}
      </div>
      <div
        className="docs-choice"
        id="docs-choice-panel"
        role="tabpanel"
        aria-labelledby={`docs-${choice}`}
      >
        {choice === "cursor" ? (
          <>
            <h2>Cursor</h2>
            <p>Install PromptMarket into the current project.</p>
            <CommandBlock command={CURSOR_COMMAND} label="Copy Cursor setup" />
            <ul className="docs-checks">
              <li>PromptMarket MCP</li>
              <li>Project workflow rule</li>
              <li>Optional Context7 setup</li>
            </ul>
          </>
        ) : null}
        {choice === "cli" ? (
          <>
            <h2>CLI</h2>
            <p>
              Resolve a feature, print a plan, and check a feature contract.
            </p>
            <CommandBlock command={CLI_COMMANDS} label="Copy CLI examples" />
            <p>
              <a href="/docs/cli">View all CLI commands</a>
            </p>
          </>
        ) : null}
        {choice === "mcp" ? (
          <>
            <h2>MCP</h2>
            <p>Point a client at the hosted endpoint.</p>
            <CommandBlock command={HOSTED_MCP_URL} label="Copy MCP endpoint" />
            <p>
              <a href="/docs/mcp">View MCP tools</a>
            </p>
          </>
        ) : null}
        {choice === "web" ? (
          <>
            <h2>Web</h2>
            <p>
              Resolve a feature in the browser, then open the guide or prompt.
            </p>
            <ul className="docs-checks">
              <li>
                <a href="/context">Context</a> picks the pattern and plan
              </li>
              <li>
                <a href="/guides">Guides</a> build a complete app
              </li>
              <li>
                <a href="/learn">Learn</a> explains the pattern
              </li>
              <li>
                <a href="/prompts">Prompts</a> are ready to copy
              </li>
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
