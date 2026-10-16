# DB Release Runbook

This runbook defines how to promote database changes safely between testing and production.

## Core rule

Do not rely on merge timing alone. Choose migration timing based on compatibility risk.

## Compatibility classes

### 1) Backward-compatible migration (low risk)

Examples:
- add nullable column
- add new table
- add non-breaking index

Recommended order:
1. PR checks green
2. Merge code
3. Promote DB to production (or before merge if preferred)

### 2) Non-backward-compatible migration (high risk)

Examples:
- rename/drop column used by running code
- enforce NOT NULL on active path
- destructive schema changes

Recommended order:
1. PR checks green
2. Promote DB to production first (manual, controlled)
3. Merge/deploy application code

If possible, use **expand -> migrate code -> contract** instead of one-step destructive changes.

## Check what is pending first (writes nothing)

From repo root:

- `npm run db:testing:dry` lists the migration files Testing does not have yet.
- `npm run db:prod:dry` lists the ones Production does not have yet.

Each links the CLI to that project, runs `supabase db push --dry-run`, and (for production)
links back to Testing. "Remote database is up to date" means nothing is pending.

## Promotion command (manual step)

From repo root:

`DOC_CY_CONFIRM_PROD=YES npm run db:prod:push`

The `DOC_CY_CONFIRM_PROD=YES` flag is required to avoid accidental production pushes.

### Why `supabase/config.toml` has `[remotes.*]` blocks

`[db.migrations] enabled = false` there is for the local CI stack (it loads a schema snapshot
instead of building one from the migrations). The same switch used to make a push to Testing
or Production print "Skipping migrations", apply nothing and exit 0. The `[remotes.testing]` and
`[remotes.production]` blocks turn migrations back on for those two project refs only; the CI
stack matches neither. `scripts/supabase-safe.mjs` refuses to push to a project whose block is
missing or off, so that quiet no-op cannot come back (`tests/unit/supabase-remote-config.test.ts`).

The CLI says `Loading config override: [remotes.testing]` when it reads a block. It does so for
`db push` to a linked project; `supabase status` and `migration list --local` on a linked checkout
do not load it (checked 2026-10-16), so the local stack keeps migrations off.

### If a migration was applied by hand

Applying the SQL directly (the SQL editor, `execute_sql`) skips the CLI's history. Add the row
in the same step, or the next push will try to apply it again and, if a newer migration is
already in, refuse with "found local migration files to be inserted before the last migration":

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('<file version>', '<file name>')
on conflict (version) do nothing;
```

Do not use the Supabase MCP `apply_migration` for repo migrations: it records its own
timestamp as the version, which is not in `supabase/migrations/`.

## Operator handshake

When checks are green and you want promotion, use this explicit instruction in chat:

`promociona DB a prod`

The agent should then:
1. Confirm target is production
2. Run the protected command
3. Report result and any follow-up verification

## Important

- Never push production DB changes during uncertain CI state.
- Never run destructive DB operations without explicit approval and rollback plan.
