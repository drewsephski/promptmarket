import { parse } from "yaml";

export type DependencyChange = {
  packageName: string;
  from: string;
  to: string;
};

export type VersionIndex = Record<string, string[]>;

const LOCKFILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "bun.lock",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericVersion(value: string): string | undefined {
  const match = /(\d+\.\d+\.\d+|\d+\.\d+|\d+)/.exec(value);
  return match?.[1];
}

function remember(index: VersionIndex, name: string, version: string | undefined): void {
  if (!version) {
    return;
  }
  const current = index[name] ?? [];
  if (!current.includes(version)) {
    current.push(version);
    index[name] = current;
  }
}

function rememberDeclared(index: VersionIndex, name: string, range: unknown): void {
  if (typeof range !== "string") {
    return;
  }
  remember(index, name, numericVersion(range));
}

function basename(file: string): string {
  const normalized = file.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function isDependencyManifest(file: string): boolean {
  const name = basename(file);
  return name === "package.json" || LOCKFILES.has(name);
}

function versionsFromPackageJson(text: string): VersionIndex {
  const index: VersionIndex = {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return index;
  }
  if (!isRecord(parsed)) {
    return index;
  }
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const section = parsed[field];
    if (!isRecord(section)) {
      continue;
    }
    for (const [name, range] of Object.entries(section)) {
      rememberDeclared(index, name, range);
    }
  }
  return index;
}

function resolvedToken(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const stripped = value.split("(")[0] ?? value;
  return numericVersion(stripped);
}

function versionsFromPnpm(text: string): VersionIndex {
  const index: VersionIndex = {};
  let parsed: unknown;
  try {
    parsed = parse(text);
  } catch {
    return index;
  }
  if (!isRecord(parsed) || !isRecord(parsed.importers)) {
    return index;
  }
  for (const importer of Object.values(parsed.importers)) {
    if (!isRecord(importer)) {
      continue;
    }
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
      const section = importer[field];
      if (!isRecord(section)) {
        continue;
      }
      for (const [name, entry] of Object.entries(section)) {
        if (!isRecord(entry)) {
          continue;
        }
        rememberDeclared(index, name, entry.specifier);
        remember(index, name, resolvedToken(entry.version));
      }
    }
  }
  return index;
}

function packageNameFromLockPath(key: string): string | undefined {
  const marker = "node_modules/";
  const at = key.lastIndexOf(marker);
  if (at === -1) {
    return undefined;
  }
  const name = key.slice(at + marker.length);
  if (name.length === 0 || name.includes("/node_modules/")) {
    return undefined;
  }
  return name;
}

function versionsFromPackageLock(text: string): VersionIndex {
  const index: VersionIndex = {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return index;
  }
  if (!isRecord(parsed)) {
    return index;
  }
  if (isRecord(parsed.packages)) {
    for (const [key, entry] of Object.entries(parsed.packages)) {
      const name = packageNameFromLockPath(key);
      if (!name || !isRecord(entry)) {
        continue;
      }
      remember(index, name, resolvedToken(entry.version));
    }
  }
  if (isRecord(parsed.dependencies)) {
    for (const [name, entry] of Object.entries(parsed.dependencies)) {
      if (!isRecord(entry)) {
        continue;
      }
      remember(index, name, resolvedToken(entry.version));
    }
  }
  return index;
}

function versionsFromYarn(text: string): VersionIndex {
  const index: VersionIndex = {};
  let current: string[] = [];
  for (const line of text.split("\n")) {
    const header = /^"?((?:@[^/"\s]+\/)?[^@"\s]+)@/.exec(line);
    if (header?.[1] && !line.startsWith(" ")) {
      current = [header[1]];
      continue;
    }
    const version = /^\s+version:?\s+"?(\d+\.\d+\.\d+)/.exec(line);
    if (!version?.[1]) {
      continue;
    }
    for (const name of current) {
      remember(index, name, version[1]);
    }
  }
  return index;
}

export function versionsInFile(file: string, text: string): VersionIndex {
  if (text.trim().length === 0) {
    return {};
  }
  const name = basename(file);
  if (name === "package.json") {
    return versionsFromPackageJson(text);
  }
  if (name === "pnpm-lock.yaml") {
    return versionsFromPnpm(text);
  }
  if (name === "package-lock.json" || name === "npm-shrinkwrap.json") {
    return versionsFromPackageLock(text);
  }
  if (name === "yarn.lock" || name === "bun.lock") {
    return versionsFromYarn(text);
  }
  return {};
}

export function mergeVersions(target: VersionIndex, extra: VersionIndex): void {
  for (const [name, versions] of Object.entries(extra)) {
    for (const version of versions) {
      remember(target, name, version);
    }
  }
}

function sameVersions(left: string[] | undefined, right: string[] | undefined): boolean {
  const a = [...(left ?? [])].sort();
  const b = [...(right ?? [])].sort();
  return a.length === b.length && a.every(function equal(version, index) {
    return version === b[index];
  });
}

export function dependencyChanges(before: VersionIndex, after: VersionIndex): DependencyChange[] {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes: DependencyChange[] = [];
  for (const packageName of names) {
    const from = before[packageName];
    const to = after[packageName];
    if (sameVersions(from, to)) {
      continue;
    }
    changes.push({
      packageName,
      from: (from ?? []).join(", "),
      to: (to ?? []).join(", "),
    });
  }
  return changes;
}

export function formatDependencyChange(change: DependencyChange): string {
  const from = change.from.length > 0 ? change.from : "absent";
  const to = change.to.length > 0 ? change.to : "absent";
  return `${change.packageName}@${from} → ${change.packageName}@${to}`;
}
