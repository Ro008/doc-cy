# CLAUDE.md

Working instructions for Claude Code in this repo.

## Workflow: TDD (tests first)

For new features or non-trivial bug fixes, follow this order:

1. **Write the tests first**, covering the happy path, relevant edge cases, and error cases. They should fail at this point (the implementation doesn't exist yet).
2. **Verify they fail** before touching production code — confirm the failure is due to the missing/incorrect implementation, not a badly written test.
3. **Implement** until the tests pass.

**Does not apply** to trivial changes (a typo, a rename, style/config tweaks) — no need to add process overhead there.

If explicitly asked to skip this flow for a specific task, it can be skipped.

## Branch handoff: `feat/doctor-dashboard` (temporary, remove before merging)

If you are working on the branch `feat/doctor-dashboard`, read `docs/handoff/README.md` first. The
frontend is finished and every product decision is already taken. Your job is to build the backend and
database changes it lists, run the e2e and open the PR. Do not change the frontend behaviour or reopen
those decisions; ask Rocío if something does not fit.
