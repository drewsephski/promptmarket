import { describe, expect, test } from "vitest";
import {
  exportAuthoringDraft,
  previewAuthoringDraft,
} from "../lib/authoring-api";

const valid = {
  name: "sample-agent",
  version: "0.1.0",
  description: "Review a local diff.",
  author: { name: "Ada Lovelace" },
  compatibility: ["cursor", "codex"],
  tags: ["review"],
  requires: { mcp: [] },
  capabilities: { filesystem: "read", shell: false, network: ["github.com"] },
  instructions: "# Sample Agent\n\nRead the diff.\n",
};

describe("web authoring", function webAuthoring() {
  test("previews a valid package and rejects author mistakes", function previews() {
    const ready = previewAuthoringDraft(valid);
    expect(ready.ok).toBe(true);
    expect(ready.files["promptmarket.yaml"]).not.toContain("description:");
    expect(ready.files["SKILL.md"]).toContain(
      "description: Review a local diff.",
    );

    const invalid = previewAuthoringDraft({
      ...valid,
      name: "Bad Name",
      version: "banana",
      description: "",
      capabilities: { ...valid.capabilities, network: ["https://github.com"] },
    });
    expect(invalid.ok).toBe(false);
    expect(
      invalid.issues.map(function codeOf(issue) {
        return issue.message;
      }),
    ).toEqual(
      expect.arrayContaining([
        "Recipe names are lowercase kebab-case.",
        "Version must be valid SemVer.",
        "SKILL description is required.",
        "Network host is malformed.",
      ]),
    );
  });

  test("exports the same rendered files in a zip", function exportsZip() {
    const exported = exportAuthoringDraft(valid);
    expect(exported.ok).toBe(true);
    if (!exported.ok) {
      return;
    }
    const preview = previewAuthoringDraft(valid);
    const archive = Buffer.from(exported.bytes).toString("utf8");
    expect(exported.filename).toBe("sample-agent.zip");
    expect(archive.startsWith("PK")).toBe(true);
    expect(archive).toContain("sample-agent/promptmarket.yaml");
    expect(archive).toContain("sample-agent/SKILL.md");
    expect(archive).toContain(preview.files["SKILL.md"].slice(0, 40));

    const rejected = exportAuthoringDraft({ ...valid, description: "" });
    expect(rejected.ok).toBe(false);
  });
});
