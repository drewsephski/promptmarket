import { spawn } from "node:child_process";

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
