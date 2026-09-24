import type { CompatibilityItem } from "./compatibility.js";
import type { BuiltContext, ProjectNote } from "./context.js";
import type { ImplementationPlan } from "./plan.js";
import type { ProjectContext } from "./project.js";

function majorOf(version: string | undefined): string | undefined {
  if (!version) {
    return undefined;
  }
  return version.split(".")[0];
}

function withVersion(label: string, version: string | undefined): string {
  const major = majorOf(version);
  return major ? `${label} ${major}` : label;
}

function versionAtPrecision(detected: string, tested: string): string {
  const parts = detected.split(".");
  const width = tested.split(".").filter(function present(part) {
    return part.length > 0;
  }).length;
  return parts.slice(0, width).join(".");
}

export function formatCompatibility(items: CompatibilityItem[]): string[] {
  return items.map(function line(item) {
    if (item.status === "match") {
      return `✓ ${item.label} ${item.tested}`;
    }
    if (item.status === "not-detected") {
      return `○ ${item.label} not detected; guide verified with ${item.tested}`;
    }
    const seen = item.detected
      ? `${item.label} ${versionAtPrecision(item.detected, item.tested)}`
      : item.label;
    return `! ${seen} → guide verified with ${item.label} ${item.tested}`;
  });
}

export function formatNotes(notes: ProjectNote[]): string[] {
  const lines: string[] = [];
  const detected = notes.filter(function keep(note) {
    return note.status === "detected";
  });
  const unseen = notes.filter(function keep(note) {
    return note.status === "not-detected";
  });
  const required = notes.filter(function keep(note) {
    return note.status === "required";
  });
  if (detected.length > 0) {
    lines.push("Detected in project");
    for (const note of detected) {
      lines.push(`✓ ${note.label}`);
    }
  }
  if (unseen.length > 0) {
    lines.push("Not detected");
    for (const note of unseen) {
      lines.push(`○ ${note.label}`);
    }
  }
  if (required.length > 0) {
    lines.push("Required by guide");
    for (const note of required) {
      lines.push(`○ ${note.label}`);
    }
  }
  return lines;
}

export function formatContextText(context: BuiltContext): string {
  const lines: string[] = [];
  if (context.project) {
    lines.push("PROJECT");
    for (const label of [
      context.project.framework,
      context.project.language,
      context.project.ai?.sdk,
      context.project.ai?.provider,
      ...(context.project.database ?? []),
      ...(context.project.orm ?? []),
    ]) {
      if (label) {
        lines.push(label);
      }
    }
    lines.push("");
  }
  if (context.projectNotes && context.projectNotes.length > 0) {
    lines.push("PROJECT NOTES");
    lines.push(...formatNotes(context.projectNotes), "");
  }
  if (context.topics.length > 0) {
    lines.push("CONCEPTS");
    const [primary, ...related] = context.topics;
    if (primary) {
      lines.push(primary.title, primary.definition);
      if (primary.mentalModel) {
        lines.push(primary.mentalModel);
      }
      if (primary.commonMistake) {
        lines.push(primary.commonMistake);
      }
      lines.push("");
    }
    if (related.length > 0) {
      lines.push("RELATED CONCEPTS");
      for (const topic of related) {
        lines.push(topic.title);
      }
      lines.push("");
    }
  }
  if (context.prompts.length > 0) {
    lines.push("PROMPTS");
    const [primary, ...related] = context.prompts;
    if (primary) {
      lines.push(
        primary.name,
        primary.title,
        primary.variables.length > 0
          ? `Variables: ${primary.variables.join(", ")}`
          : "Variables: none",
        "",
        primary.body ?? "",
        "",
      );
    }
    if (related.length > 0) {
      lines.push("RELATED");
      for (const prompt of related) {
        lines.push(prompt.name);
      }
      lines.push("");
    }
  }
  if (context.guides.length > 0) {
    lines.push("GUIDES");
    const [primary, ...related] = context.guides;
    if (primary) {
      lines.push(primary.title, primary.url);
      if (primary.architecture.length > 0) {
        lines.push(primary.architecture.join(" → "));
      }
      for (const section of primary.sections) {
        lines.push(section.title);
      }
      lines.push("");
    }
    if (related.length > 0) {
      lines.push("RELATED GUIDES");
      for (const guide of related) {
        lines.push(guide.title);
      }
      lines.push("");
    }
  }
  if (context.compatibility && context.compatibility.length > 0) {
    lines.push("COMPATIBILITY");
    lines.push(...formatCompatibility(context.compatibility), "");
  }
  if (context.skills.length > 0) {
    lines.push("SKILLS");
    for (const skill of context.skills) {
      lines.push(`${skill.name}\t${skill.version}`, skill.description, "");
    }
  }
  if (context.suggestedNextSteps.length > 0) {
    lines.push("NEXT");
    for (const step of context.suggestedNextSteps) {
      lines.push(`${step.title}: ${step.reason}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function formatPlan(plan: ImplementationPlan): string {
  const lines = ["Goal", plan.goal, ""];
  if (plan.project) {
    lines.push("Detected project");
    for (const label of projectLines(plan.project)) {
      lines.push(label);
    }
    lines.push("");
  }
  lines.push("Recommended pattern", plan.pattern.topic, plan.pattern.reason, "");
  if (plan.architecture.length > 0) {
    lines.push("Recommended architecture", plan.architecture.join(" → "), "");
  }
  if (plan.requirements.length > 0) {
    lines.push(...formatNotes(plan.requirements), "");
  }
  if (plan.steps.length > 0) {
    lines.push("Implementation");
    plan.steps.forEach(function line(step, index) {
      lines.push(`${index + 1}. ${step.title}`);
      lines.push(step.guidance);
    });
    lines.push("");
  }
  if (plan.prompt) {
    lines.push("Prompt", plan.prompt.title, plan.prompt.body ?? plan.prompt.description, "");
  }
  if (plan.verification.length > 0) {
    lines.push("Verification");
    for (const item of plan.verification) {
      lines.push(`□ ${item}`);
    }
    lines.push("");
  }
  if (plan.guide) {
    lines.push(
      "Reference",
      plan.guide.title,
      plan.guide.verifiedAt ? `Verified: ${plan.guide.verifiedAt}` : plan.guide.slug,
      "",
    );
  }
  if (plan.compatibility.length > 0) {
    lines.push("Compatibility", ...formatCompatibility(plan.compatibility), "");
  }
  return `${lines.join("\n")}\n`;
}

export function formatAgentContext(context: BuiltContext): string {
  const lines = [
    "# PromptMarket Implementation Context",
    "",
    "## Goal",
    context.query,
    "",
  ];
  if (context.project) {
    lines.push("## Detected project");
    for (const label of projectLines(context.project)) {
      lines.push(`- ${label}`);
    }
    lines.push("");
  }
  const topic = context.topics[0];
  if (topic) {
    lines.push("## Recommended pattern", topic.title, "", topic.definition, "");
    if (topic.mentalModel) {
      lines.push(topic.mentalModel, "");
    }
  }
  const guide = context.guides[0];
  if (guide) {
    lines.push("## Recommended guide", guide.title, "");
    if (guide.sections.length > 0) {
      lines.push("Relevant sections:");
      for (const section of guide.sections) {
        lines.push(`- ${section.title}`);
      }
      lines.push("");
    }
  }
  const prompt = context.prompts[0];
  if (prompt) {
    lines.push(
      "## Prompt",
      prompt.title,
      "",
      prompt.body ?? prompt.description,
      "",
    );
  }
  if (context.compatibility && context.compatibility.length > 0) {
    lines.push(
      "## Compatibility",
      ...formatCompatibility(context.compatibility),
      "",
    );
  }
  const constraints = [
    ...(topic?.commonMistake ? [topic.commonMistake] : []),
    ...(prompt?.commonMistakes ?? []),
  ].filter(function present(item) {
    return item.trim().length > 0;
  });
  if (constraints.length > 0) {
    lines.push("## Important constraints");
    for (const constraint of constraints.slice(0, 4)) {
      lines.push(`- ${constraint.replaceAll("\n", " ")}`);
    }
    lines.push("");
  }
  const references = [topic?.url, prompt?.url, guide?.url].filter(
    function present(url): url is string {
      return Boolean(url);
    },
  );
  if (references.length > 0) {
    lines.push("## References");
    for (const url of references) {
      lines.push(`- ${url}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function projectLines(project: ProjectContext): string[] {
  return [
    project.framework,
    project.language,
    project.ai?.sdk
      ? withVersion(project.ai.sdk, project.versions.ai)
      : undefined,
    project.ai?.provider,
    ...(project.database ?? []),
    ...(project.orm ?? []),
  ].filter(function present(label): label is string {
    return Boolean(label);
  });
}
