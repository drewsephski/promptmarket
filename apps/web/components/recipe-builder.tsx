"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AGENT_COMPATIBILITY,
  FILESYSTEM_CAPABILITIES,
  scaffoldInstructions,
} from "@promptmarket/schema";
import { submitCommand } from "../lib/present";
import { Bezel } from "./bezel";
import { CommandBlock } from "./command-block";

type AuthorIssue = {
  code: string;
  path: string;
  message: string;
};

type Preview = {
  ok: boolean;
  issues: AuthorIssue[];
  files: {
    "promptmarket.yaml": string;
    "SKILL.md": string;
  };
};

const FIELD_CODES: Record<string, string[]> = {
  name: ["recipe_name_invalid", "name_mismatch"],
  version: ["invalid_version", "version_mismatch"],
  description: ["skill_description_missing"],
  author: ["author_missing", "author_url_invalid"],
  compatibility: ["compatibility_invalid"],
  tags: ["tag_invalid"],
  filesystem: ["filesystem_invalid"],
  network: ["network_invalid"],
  mcp: ["mcp_invalid"],
  instructions: ["instructions_missing"],
};

function issuesFor(issues: AuthorIssue[], field: string): AuthorIssue[] {
  const codes = FIELD_CODES[field] ?? [];
  return issues.filter(function matches(issue) {
    return codes.includes(issue.code) || issue.path.startsWith(field);
  });
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map(function trim(item) {
      return item.trim();
    })
    .filter(function nonEmpty(item) {
      return item.length > 0;
    });
}

export function RecipeBuilder() {
  const [name, setName] = useState("my-recipe");
  const [version, setVersion] = useState("0.1.0");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [authorUrl, setAuthorUrl] = useState("");
  const [tags, setTags] = useState("");
  const [compatibility, setCompatibility] = useState<string[]>(["generic"]);
  const [filesystem, setFilesystem] = useState<string>("none");
  const [shell, setShell] = useState(false);
  const [network, setNetwork] = useState("");
  const [mcp, setMcp] = useState("");
  const [instructions, setInstructions] = useState(() =>
    scaffoldInstructions("my-recipe", ""),
  );
  const [instructionsEdited, setInstructionsEdited] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [exportError, setExportError] = useState("");

  useEffect(
    function refreshScaffold() {
      if (instructionsEdited) {
        return;
      }
      setInstructions(scaffoldInstructions(name || "recipe", description));
    },
    [description, instructionsEdited, name],
  );

  useEffect(
    function previewDraft() {
      const controller = new AbortController();
      const timer = setTimeout(function requestPreview() {
        const draft = {
          name,
          version,
          description,
          author: {
            name: author,
            ...(authorUrl.trim().length > 0 ? { url: authorUrl.trim() } : {}),
          },
          compatibility,
          tags: splitList(tags),
          requires: { mcp: splitList(mcp) },
          capabilities: {
            filesystem,
            shell,
            network: splitList(network),
          },
          instructions,
        };
        void fetch("/api/authoring/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
          signal: controller.signal,
        })
          .then(async function read(response) {
            return (await response.json()) as Preview;
          })
          .then(function store(next) {
            setPreview(next);
          })
          .catch(function ignore(error: unknown) {
            if (error instanceof DOMException && error.name === "AbortError") {
              return;
            }
          });
      }, 200);
      return function cancel() {
        clearTimeout(timer);
        controller.abort();
      };
    },
    [
      author,
      authorUrl,
      compatibility,
      description,
      filesystem,
      instructions,
      mcp,
      name,
      network,
      shell,
      tags,
      version,
    ],
  );

  const issues = preview?.issues ?? [];
  const ready = preview?.ok === true;

  async function handleDownload() {
    setExportError("");
    const draft = {
      name,
      version,
      description,
      author: {
        name: author,
        ...(authorUrl.trim().length > 0 ? { url: authorUrl.trim() } : {}),
      },
      compatibility,
      tags: splitList(tags),
      requires: { mcp: splitList(mcp) },
      capabilities: {
        filesystem,
        shell,
        network: splitList(network),
      },
      instructions,
    };
    const response = await fetch("/api/authoring/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { issues?: AuthorIssue[] };
      setPreview(function current(existing) {
        return {
          ok: false,
          issues: payload.issues ?? [],
          files: existing?.files ?? {
            "promptmarket.yaml": "",
            "SKILL.md": "",
          },
        };
      });
      setExportError("Fix the validation issues before downloading.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleCompatibility(agent: string) {
    setCompatibility(function current(selected) {
      if (selected.includes(agent)) {
        return selected.filter(function keep(item) {
          return item !== agent;
        });
      }
      return [...selected, agent];
    });
  }

  return (
    <div className="builder">
      <Bezel coreClassName="panel builder-form">
        <form
          onSubmit={function handleSubmit(event) {
            event.preventDefault();
          }}
        >
          <Field
            id="recipe-name"
            label="Name"
            issues={issuesFor(issues, "name")}
          >
            <input
              id="recipe-name"
              className="control"
              value={name}
              autoComplete="off"
              aria-invalid={issuesFor(issues, "name").length > 0}
              onChange={function handleName(event) {
                setName(event.target.value);
              }}
            />
          </Field>
          <Field
            id="recipe-version"
            label="Version"
            issues={issuesFor(issues, "version")}
          >
            <input
              id="recipe-version"
              className="control"
              value={version}
              autoComplete="off"
              aria-invalid={issuesFor(issues, "version").length > 0}
              onChange={function handleVersion(event) {
                setVersion(event.target.value);
              }}
            />
          </Field>
          <Field
            id="recipe-description"
            label="Description"
            issues={issuesFor(issues, "description")}
          >
            <textarea
              id="recipe-description"
              className="control"
              rows={3}
              value={description}
              aria-invalid={issuesFor(issues, "description").length > 0}
              onChange={function handleDescription(event) {
                setDescription(event.target.value);
              }}
            />
          </Field>
          <Field
            id="recipe-author"
            label="Author"
            issues={issuesFor(issues, "author")}
          >
            <input
              id="recipe-author"
              className="control"
              value={author}
              autoComplete="name"
              aria-invalid={issuesFor(issues, "author").length > 0}
              onChange={function handleAuthor(event) {
                setAuthor(event.target.value);
              }}
            />
            <input
              id="recipe-author-url"
              className="control"
              value={authorUrl}
              placeholder="https://example.com"
              aria-label="Author URL"
              autoComplete="url"
              onChange={function handleAuthorUrl(event) {
                setAuthorUrl(event.target.value);
              }}
            />
          </Field>
          <Field
            id="recipe-tags"
            label="Tags"
            issues={issuesFor(issues, "tags")}
          >
            <input
              id="recipe-tags"
              className="control"
              value={tags}
              placeholder="review, github"
              aria-invalid={issuesFor(issues, "tags").length > 0}
              onChange={function handleTags(event) {
                setTags(event.target.value);
              }}
            />
          </Field>
          <fieldset className="field">
            <legend>Compatibility</legend>
            <div className="checks">
              {AGENT_COMPATIBILITY.map(function renderAgent(agent) {
                const checked = compatibility.includes(agent);
                return (
                  <label key={agent}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={function handleAgent() {
                        handleCompatibility(agent);
                      }}
                    />
                    {agent}
                  </label>
                );
              })}
            </div>
            <IssueList issues={issuesFor(issues, "compatibility")} />
          </fieldset>
          <Field
            id="recipe-filesystem"
            label="Filesystem"
            issues={issuesFor(issues, "filesystem")}
          >
            <select
              id="recipe-filesystem"
              className="control"
              value={filesystem}
              onChange={function handleFilesystem(event) {
                setFilesystem(event.target.value);
              }}
            >
              {FILESYSTEM_CAPABILITIES.map(function renderMode(mode) {
                return (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                );
              })}
            </select>
          </Field>
          <label className="check-line">
            <input
              type="checkbox"
              checked={shell}
              onChange={function handleShell(event) {
                setShell(event.target.checked);
              }}
            />
            Allow shell access
          </label>
          <Field
            id="recipe-network"
            label="Network domains"
            issues={issuesFor(issues, "network")}
          >
            <input
              id="recipe-network"
              className="control"
              value={network}
              placeholder="github.com"
              aria-invalid={issuesFor(issues, "network").length > 0}
              onChange={function handleNetwork(event) {
                setNetwork(event.target.value);
              }}
            />
          </Field>
          <Field
            id="recipe-mcp"
            label="MCP dependencies"
            issues={issuesFor(issues, "mcp")}
          >
            <input
              id="recipe-mcp"
              className="control"
              value={mcp}
              placeholder="io.github.github/github-mcp-server"
              aria-invalid={issuesFor(issues, "mcp").length > 0}
              onChange={function handleMcp(event) {
                setMcp(event.target.value);
              }}
            />
          </Field>
          <Field
            id="recipe-instructions"
            label="SKILL instructions"
            issues={issuesFor(issues, "instructions")}
          >
            <textarea
              id="recipe-instructions"
              className="control instructions"
              rows={14}
              value={instructions}
              aria-invalid={issuesFor(issues, "instructions").length > 0}
              onChange={function handleInstructions(event) {
                setInstructionsEdited(true);
                setInstructions(event.target.value);
              }}
            />
          </Field>
        </form>
      </Bezel>
      <div className="builder-preview">
        <Bezel coreClassName="panel">
          <h2>{ready ? "Ready to package" : "Validation"}</h2>
          {ready ? (
            <p className="note">
              Schema, frontmatter, and package rules passed.
            </p>
          ) : (
            <IssueList issues={issues} />
          )}
          {exportError ? <p className="error">{exportError}</p> : null}
          <button
            type="button"
            className="pill"
            disabled={!ready}
            onClick={function handleClick() {
              void handleDownload();
            }}
          >
            Download recipe
          </button>
        </Bezel>
        <Bezel coreClassName="panel">
          <h2>promptmarket.yaml</h2>
          <pre className="package-preview">
            <code>{preview?.files["promptmarket.yaml"] ?? ""}</code>
          </pre>
        </Bezel>
        <Bezel coreClassName="panel">
          <h2>SKILL.md</h2>
          <pre className="package-preview">
            <code>{preview?.files["SKILL.md"] ?? ""}</code>
          </pre>
        </Bezel>
        <Bezel coreClassName="panel">
          <h2>Submit</h2>
          <p className="note">
            V0.3 publishing opens a GitHub pull request. It needs the GitHub CLI
            authenticated with <code>gh auth login</code>. PromptMarket does not
            ask for a token.
          </p>
          <CommandBlock
            command={submitCommand(name)}
            label="Copy submit command"
          />
        </Bezel>
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  issues: AuthorIssue[];
  children: ReactNode;
}

function Field({ id, label, issues, children }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      <div id={errorId}>
        <IssueList issues={issues} />
      </div>
    </div>
  );
}

function IssueList({ issues }: { issues: AuthorIssue[] }) {
  if (issues.length === 0) {
    return null;
  }
  return (
    <ul className="issue-list">
      {issues.map(function renderIssue(issue) {
        return <li key={`${issue.code}-${issue.path}`}>{issue.message}</li>;
      })}
    </ul>
  );
}
