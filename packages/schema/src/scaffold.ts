export function titleFromRecipeName(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(function nonEmpty(word) {
    return word.length > 0;
  });
  if (words.length === 0) {
    return "Recipe";
  }
  return words
    .map(function titleCase(word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function scaffoldInstructions(
  name: string,
  description: string,
): string {
  const summary = description.trim();
  const when =
    summary.length > 0 ? summary : "Describe when this recipe applies.";
  return [
    `# ${titleFromRecipeName(name)}`,
    "",
    "## When to use",
    "",
    when,
    "",
    "## Workflow",
    "",
    "1. Read the request and name the files it depends on.",
    "2. Carry out that request using only the capabilities declared for this recipe.",
    "3. Check the result against the rules below before finishing.",
    "",
    "## Rules",
    "",
    "- Stay inside the filesystem, shell, and network access declared in promptmarket.yaml.",
    "- Do not invent requirements the request did not state.",
    "- If a required input is missing, name it and stop.",
    "",
    "## Output",
    "",
    "- What changed",
    "- Files read or changed",
    "- Checks that failed, if any",
    "",
  ].join("\n");
}
