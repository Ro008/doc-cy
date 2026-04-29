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

## Promotion command (manual step)

From repo root:

`DOC_CY_CONFIRM_PROD=YES npm run db:prod:push`

The `DOC_CY_CONFIRM_PROD=YES` flag is required to avoid accidental production pushes.

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
