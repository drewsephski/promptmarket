import type { RecipeManifest } from "@promptmarket/schema";
import type { RecipeIssue, SkillDocument } from "./types.js";

const NETWORK_HOST =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const MCP_ID =
  /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/;
const TAG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isNetworkHost(value: string): boolean {
  return value.length > 0 && value.length <= 253 && NETWORK_HOST.test(value);
}

export function isMcpDependencyId(value: string): boolean {
  return value.length > 0 && value.length <= 256 && MCP_ID.test(value);
}

export function isRecipeTag(value: string): boolean {
  return value.length > 0 && value.length <= 32 && TAG.test(value);
}

export function policyIssues(
  manifest: RecipeManifest,
  skill: SkillDocument,
): RecipeIssue[] {
  const issues: RecipeIssue[] = [];
  if (skill.body.trim().length === 0) {
    issues.push({
      code: "instructions_missing",
      path: "SKILL.md",
      message: "SKILL instructions are required.",
    });
  }

  manifest.tags.forEach(function checkTag(tag, index) {
    if (!isRecipeTag(tag)) {
      issues.push({
        code: "tag_invalid",
        path: `tags.${index}`,
        message: "Tags are lowercase kebab-case.",
      });
    }
  });

  manifest.capabilities.network.forEach(function checkHost(host, index) {
    if (!isNetworkHost(host)) {
      issues.push({
        code: "network_invalid",
        path: `capabilities.network.${index}`,
        message: "Network host is malformed.",
      });
    }
  });

  manifest.requires.mcp.forEach(function checkMcp(id, index) {
    if (!isMcpDependencyId(id)) {
      issues.push({
        code: "mcp_invalid",
        path: `requires.mcp.${index}`,
        message:
          "MCP dependency ID is malformed. Use a publisher/name identifier. This check does not contact the server.",
      });
    }
  });

  return issues;
}
