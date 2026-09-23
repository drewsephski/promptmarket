# Expand, then contract

Ship a breaking schema change in steps so a running application does not read or write a column that has already disappeared.

## Expand

Add the new nullable column, table, or index. Keep the old shape in place. Deploy application code that writes both shapes and reads the old shape.

## Backfill

Copy existing rows into the new shape with a command that can be resumed. Do this only after the expand has deployed. Verify row counts before continuing.

## Switch reads

Deploy application code that reads the new shape. Keep writing both shapes until that deploy is the only running version.

## Contract

Stop writing the old shape. Deploy that code. Only in a later migration, drop the old column, table, or constraint.

## One-step changes

A new nullable column with no backfill can ship in one migration. A drop, rename, or `NOT NULL` on existing rows cannot.
