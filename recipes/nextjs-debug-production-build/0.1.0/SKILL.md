---
name: nextjs-debug-production-build
description: Diagnose a failing Next.js production build. Use when next build fails or production behavior diverges from the dev server.
---

# Debug a Next.js production build

Find why `next build` fails, or why the production build behaves differently from `next dev`. Fix the cause in the repo and rerun the build.

## Workflow

1. Read `package.json` and the Next config. Note the Next.js version, the package manager, and whether the app uses the App Router, the Pages Router, or both.
2. Run the production build with the repo's script, usually `pnpm build`, `npm run build`, or `yarn build`. Keep the first error and the file it names.
3. Open that file and the route or module it imports. Classify the failure:
   - Type error
   - Server/client boundary (`use client`, server-only import, or a Node API in a client component)
   - Missing environment variable read at build time
   - Invalid route or metadata export
   - Dependency that only works in dev
4. Change the smallest file that removes the cause. Do not disable typecheck, lint, or the failing route to make the build pass.
5. Rerun the same build command. If it fails again, repeat from the new first error.
6. When the build passes, summarize the cause and the files changed.

## Rules

- Treat the build output as the source of the error. Do not start from a general Next.js checklist.
- Do not set `ignoreBuildErrors` or `typescript.ignoreBuildErrors`.
- Do not add a dependency unless the build error is a missing module the app already imports.
- If the failure is an absent environment variable, name the variable and where it is read. Do not invent a value or print secrets.

## Output

- The failing command and the first error.
- Cause, in one paragraph tied to a file.
- Files changed.
- Result of the rerun: pass, or the next remaining error.
