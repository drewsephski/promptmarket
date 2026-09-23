---
name: safe-database-migration
description: Plan or review a database schema migration without applying destructive changes. Use when asked to add, review, or sequence a database migration safely.
---

# Safe database migration

Prepare a migration that can ship while old and new application versions overlap. Do not apply it to a shared database.

## Workflow

1. Find the migration tool from the repo: Prisma, Drizzle, Knex, Flyway, Rails, Django, or a SQL directory. Read its config and the latest migration files.
2. State the schema change in one sentence: add, expand, backfill, or contract. Use `references/expand-contract.md` to split a change that both adds and removes.
3. Check lock and rewrite risk: a new column with a default that rewrites the table, a type change, a drop, or an index built without a concurrent option on a large table.
4. Check the application reads and writes that touch the changed tables. A migration that drops or renames a column while current code still uses it is unsafe to ship in one step.
5. If the repo has a migration status or dry-run command, run that command only. Do not run the command that applies migrations to a database.
6. Write the migration file only when the user asked for the file itself. Otherwise return the plan and the exact file contents they can add.

## Rules

- Do not run `migrate deploy`, `db push` against a shared database, or any command whose purpose is to apply the migration.
- Do not drop a column, table, or index in the same step that stops writing it.
- A backfill is a separate step from the schema change when existing rows must be rewritten.
- Name the table and column. Do not give generic migration advice with no object attached.

## Output

- Tool and the migration directory.
- Expand, backfill, and contract steps, including steps that are intentionally empty.
- Lock or rewrite risks.
- Application code that still depends on the old shape.
- The migration text, or the reason it was not written.
