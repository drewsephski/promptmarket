import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  dependencyChanges,
  isDependencyManifest,
  mergeVersions,
  versionsInFile,
  type DependencyChange,
  type VersionIndex,
} from "@promptmarket/content";

export type GitRunner = (args: string[], cwd: string) => Promise<string>;

export function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise(function settle(resolve, reject) {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", function chunk(data: Buffer) {
      stdout += data.toString();
    });
    child.stderr.on("data", function chunk(data: Buffer) {
      stderr += data.toString();
    });
    child.on("error", reject);
    child.on("exit", function exited(code) {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `git ${args[0] ?? "command"} failed`));
        return;
      }
      resolve(stdout);
    });
  });
}

function linesOf(stdout: string): string[] {
  return stdout
    .split("\n")
    .map(function trim(line) {
      return line.trim().replace(/\\/g, "/");
    })
    .filter(function present(line) {
      return line.length > 0;
    });
}

export async function changedFilesSince(
  root: string,
  base: string,
  git: GitRunner = runGit,
): Promise<string[]> {
  if (!base || base.startsWith("-") || base.includes("...")) {
    throw new Error("--base must be a branch, tag, or commit, such as origin/main.");
  }
  const committed = await git(
    ["diff", "--name-only", "--diff-filter=ACMRD", `${base}...HEAD`],
    root,
  );
  const worktree = await git(["diff", "--name-only", "--diff-filter=ACMRD", "HEAD"], root);
  const untracked = await git(["ls-files", "--others", "--exclude-standard"], root);
  const seen = new Set<string>();
  const files: string[] = [];
  for (const file of [...linesOf(committed), ...linesOf(worktree), ...linesOf(untracked)]) {
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    files.push(file);
  }
  return files;
}

async function fileAtRef(git: GitRunner, root: string, base: string, file: string): Promise<string> {
  try {
    return await git(["show", `${base}:${file}`], root);
  } catch {
    return "";
  }
}

async function fileNow(root: string, file: string): Promise<string> {
  try {
    return await readFile(path.join(root, file), "utf8");
  } catch {
    return "";
  }
}

export async function dependencyChangesSince(
  root: string,
  base: string,
  changedFiles: string[],
  git: GitRunner = runGit,
): Promise<DependencyChange[]> {
  const manifests = changedFiles.filter(isDependencyManifest);
  if (manifests.length === 0) {
    return [];
  }
  const before: VersionIndex = {};
  const after: VersionIndex = {};
  for (const file of manifests) {
    const [previous, current] = await Promise.all([
      fileAtRef(git, root, base, file),
      fileNow(root, file),
    ]);
    mergeVersions(before, versionsInFile(file, previous));
    mergeVersions(after, versionsInFile(file, current));
  }
  return dependencyChanges(before, after);
}
