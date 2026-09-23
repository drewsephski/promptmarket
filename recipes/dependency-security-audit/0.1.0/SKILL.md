---
name: dependency-security-audit
description: Audit project dependencies for known vulnerabilities and report upgrade risk. Use when asked for a dependency security audit.
---

# Dependency security audit

Report known vulnerabilities in the dependencies this repo actually installs. Do not upgrade them as part of the audit unless the user asked for the upgrade.

## Workflow

1. Detect the package manager from the lockfile: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `Cargo.lock`, `go.sum`, or `requirements.txt` / `uv.lock`.
2. Run that ecosystem's audit command and save the machine-readable output when it has one:
   - Node: `pnpm audit --json`, `npm audit --json`, or `yarn npm audit --all --json`
   - Rust: `cargo audit --json`
   - Go: `govulncheck ./...`
   - Python: `pip-audit -f json` when `pip-audit` is installed
3. Keep findings that name a package, a vulnerability id, and a severity. Drop findings you cannot tie to a direct or transitive dependency in the lockfile.
4. For each remaining finding, check whether the vulnerable package is imported or executed by this repo, or only present as a tool. A production runtime dependency outranks a dev tool.
5. Record the fixed version from the audit output. Do not invent a fix version.
6. Stop. List the upgrades a human could apply. Do not edit the lockfile in this pass.

## Rules

- Do not run a blanket `npm audit fix` or delete the lockfile.
- If the audit command is not installed, say which command is missing and stop. Do not guess CVEs from memory.
- Include the vulnerability id that the audit printed.
- A finding with no fixed version stays open. Say that.

## Output

- Package manager and the audit command.
- Findings, highest severity first: package, vulnerability id, severity, direct or transitive, fixed version or none.
- Findings that do not affect runtime code, listed separately.
- Upgrades left for a human. Do not claim they were applied.
