import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AGENT_COMPATIBILITY,
  FILESYSTEM_CAPABILITIES,
  scaffoldInstructions,
  SkillNameSchema,
  SemVerSchema,
  titleFromRecipeName,
} from "@promptmarket/schema";
import { stringify } from "yaml";
import { InvalidRecipeError } from "./errors.js";
import { isMcpDependencyId, isNetworkHost, isRecipeTag } from "./policy.js";
import type { RecipeIssue } from "./types.js";
import { validateRecipeTexts } from "./validate-recipe.js";

export type RecipeDraft = {
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    url?: string;
  };
  compatibility: Array<(typeof AGENT_COMPATIBILITY)[number]>;
  tags: string[];
  requires: {
    mcp: string[];
  };
  capabilities: {
    filesystem: (typeof FILESYSTEM_CAPABILITIES)[number];
    shell: boolean;
    network: string[];
  };
  instructions: string;
};

export type RenderedRecipe = {
  "promptmarket.yaml": string;
  "SKILL.md": string;
};

const COMPATIBILITY = new Set<string>(AGENT_COMPATIBILITY);
const FILESYSTEMS = new Set<string>(FILESYSTEM_CAPABILITIES);

export { scaffoldInstructions, titleFromRecipeName };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(function isString(item): item is string {
    return typeof item === "string";
  });
}

function manifestDocument(draft: RecipeDraft): Record<string, unknown> {
  const author: Record<string, string> = { name: draft.author.name };
  if (draft.author.url) {
    author.url = draft.author.url;
  }
  return {
    schemaVersion: 1,
    name: draft.name,
    version: draft.version,
    author,
    compatibility: draft.compatibility,
    requires: { mcp: draft.requires.mcp },
    capabilities: {
      filesystem: draft.capabilities.filesystem,
      network: draft.capabilities.network,
      shell: draft.capabilities.shell,
    },
    entrypoint: "SKILL.md",
    tags: draft.tags,
  };
}

export function renderRecipeDraft(draft: RecipeDraft): RenderedRecipe {
  const manifest = `${stringify(manifestDocument(draft), { lineWidth: 0 })}`;
  const frontmatter = stringify(
    { name: draft.name, description: draft.description },
    { lineWidth: 0 },
  ).trimEnd();
  const instructions = draft.instructions.replace(/\s+$/u, "");
  const skill = `---\n${frontmatter}\n---\n\n${instructions}\n`;
  return {
    "promptmarket.yaml": manifest.endsWith("\n") ? manifest : `${manifest}\n`,
    "SKILL.md": skill,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function pushUnique(issues: RecipeIssue[], issue: RecipeIssue): void {
  const exists = issues.some(function sameIssue(existing) {
    return existing.code === issue.code && existing.path === issue.path;
  });
  if (!exists) {
    issues.push(issue);
  }
}

export function validateRecipeDraft(draft: RecipeDraft): {
  ok: boolean;
  issues: RecipeIssue[];
} {
  const issues: RecipeIssue[] = [];

  if (!SkillNameSchema.safeParse(draft.name).success) {
    issues.push({
      code: "recipe_name_invalid",
      path: "name",
      message: "Recipe names are lowercase kebab-case.",
    });
  }
  if (!SemVerSchema.safeParse(draft.version).success) {
    issues.push({
      code: "invalid_version",
      path: "version",
      message: "Version must be valid SemVer.",
    });
  }
  if (draft.description.trim().length === 0) {
    issues.push({
      code: "skill_description_missing",
      path: "SKILL.md",
      message: "SKILL description is required.",
    });
  } else if (draft.description.length > 1024) {
    issues.push({
      code: "skill_description_missing",
      path: "SKILL.md",
      message: "SKILL description must be 1024 characters or fewer.",
    });
  }
  if (draft.author.name.trim().length === 0) {
    issues.push({
      code: "author_missing",
      path: "author.name",
      message: "Author name is required.",
    });
  }
  if (draft.author.url !== undefined && !isHttpUrl(draft.author.url)) {
    issues.push({
      code: "author_url_invalid",
      path: "author.url",
      message: "Author URL must be an absolute http(s) URL.",
    });
  }
  if (
    draft.compatibility.length === 0 ||
    draft.compatibility.some(function unknownAgent(agent) {
      return !COMPATIBILITY.has(agent);
    })
  ) {
    issues.push({
      code: "compatibility_invalid",
      path: "compatibility",
      message:
        `Compatibility must list one or more of: ${AGENT_COMPATIBILITY.join(", ")}.`,
    });
  }
  if (!FILESYSTEMS.has(draft.capabilities.filesystem)) {
    issues.push({
      code: "filesystem_invalid",
      path: "capabilities.filesystem",
      message: "Filesystem capability must be none, read, or write.",
    });
  }
  if (typeof draft.capabilities.shell !== "boolean") {
    issues.push({
      code: "package_structure",
      path: "capabilities.shell",
      message: "Shell capability must be true or false.",
    });
  }
  draft.tags.forEach(function checkTag(tag, index) {
    if (!isRecipeTag(tag)) {
      issues.push({
        code: "tag_invalid",
        path: `tags.${index}`,
        message: "Tags are lowercase kebab-case.",
      });
    }
  });
  draft.capabilities.network.forEach(function checkHost(host, index) {
    if (!isNetworkHost(host)) {
      issues.push({
        code: "network_invalid",
        path: `capabilities.network.${index}`,
        message: "Network host is malformed.",
      });
    }
  });
  draft.requires.mcp.forEach(function checkMcp(id, index) {
    if (!isMcpDependencyId(id)) {
      issues.push({
        code: "mcp_invalid",
        path: `requires.mcp.${index}`,
        message:
          "MCP dependency ID is malformed. Use a publisher/name identifier. This check does not contact the server.",
      });
    }
  });
  if (draft.instructions.trim().length === 0) {
    issues.push({
      code: "instructions_missing",
      path: "SKILL.md",
      message: "SKILL instructions are required.",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const rendered = renderRecipeDraft(draft);
  const revalidated = validateRecipeTexts(
    draft.name,
    rendered["promptmarket.yaml"],
    rendered["SKILL.md"],
  );
  if (!revalidated.ok) {
    for (const issue of revalidated.errors) {
      pushUnique(issues, issue);
    }
    return { ok: false, issues };
  }

  return { ok: true, issues: [] };
}

export function coerceRecipeDraft(input: unknown): {
  draft: RecipeDraft;
  issues: RecipeIssue[];
} {
  const issues: RecipeIssue[] = [];
  const record = isRecord(input) ? input : {};
  const author = isRecord(record.author) ? record.author : {};
  const requires = isRecord(record.requires) ? record.requires : {};
  const capabilities = isRecord(record.capabilities) ? record.capabilities : {};
  const authorUrl = asString(author.url).trim();
  const filesystem = asString(capabilities.filesystem);
  const rawCompatibility = asStringList(record.compatibility);
  if (
    rawCompatibility.some(function unknownAgent(agent) {
      return !COMPATIBILITY.has(agent);
    })
  ) {
    issues.push({
      code: "compatibility_invalid",
      path: "compatibility",
      message:
        `Compatibility must list one or more of: ${AGENT_COMPATIBILITY.join(", ")}.`,
    });
  }
  const compatibility = rawCompatibility.filter(
    function knownAgent(agent): agent is RecipeDraft["compatibility"][number] {
      return COMPATIBILITY.has(agent);
    },
  );
  if (filesystem.length > 0 && !FILESYSTEMS.has(filesystem)) {
    issues.push({
      code: "filesystem_invalid",
      path: "capabilities.filesystem",
      message: "Filesystem capability must be none, read, or write.",
    });
  }
  if (
    capabilities.shell !== undefined &&
    typeof capabilities.shell !== "boolean"
  ) {
    issues.push({
      code: "package_structure",
      path: "capabilities.shell",
      message: "Shell capability must be true or false.",
    });
  }

  return {
    draft: {
      name: asString(record.name).trim(),
      version: asString(record.version).trim(),
      description: asString(record.description),
      author: {
        name: asString(author.name).trim(),
        ...(authorUrl.length > 0 ? { url: authorUrl } : {}),
      },
      compatibility,
      tags: asStringList(record.tags)
        .map(function trimTag(tag) {
          return tag.trim();
        })
        .filter(function nonEmpty(tag) {
          return tag.length > 0;
        }),
      requires: {
        mcp: asStringList(requires.mcp)
          .map(function trimId(id) {
            return id.trim();
          })
          .filter(function nonEmpty(id) {
            return id.length > 0;
          }),
      },
      capabilities: {
        filesystem: FILESYSTEMS.has(filesystem)
          ? (filesystem as RecipeDraft["capabilities"]["filesystem"])
          : "none",
        shell: capabilities.shell === true,
        network: asStringList(capabilities.network)
          .map(function trimHost(host) {
            return host.trim();
          })
          .filter(function nonEmpty(host) {
            return host.length > 0;
          }),
      },
      instructions: asString(record.instructions),
    },
    issues,
  };
}

export async function writeRecipeDraft(
  directory: string,
  draft: RecipeDraft,
): Promise<RenderedRecipe> {
  const validation = validateRecipeDraft(draft);
  if (!validation.ok) {
    throw new InvalidRecipeError(directory, validation.issues);
  }
  const rendered = renderRecipeDraft(draft);
  const root = path.resolve(directory);
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "promptmarket.yaml"),
    rendered["promptmarket.yaml"],
  );
  await writeFile(path.join(root, "SKILL.md"), rendered["SKILL.md"]);
  return rendered;
}
