## Production database
The `Production DB push` check (and a sticky comment) say whether this PR needs `db:prod:push`.
- [ ] **No prod DB push** — this PR does not change `supabase/migrations/`
- [ ] **Migrations in this PR** — testing first (`npm run db:testing:push`); prod only when explicitly asked (`docs/db-release-runbook.md`)

## Local gates (not CI)
Run this **once before opening the PR**, not on every commit. It is not a blocking GitHub check (Places/Auth/Resend are too flaky and too heavy for CI).
- [ ] `npm run test:e2e:register` — live `/register` on the testing DB, founder Resend email, doctor deleted afterwards (`docs/ci-test-policy.md`)

## 🚀 Checklist de deployment
- [ ] Si hay cambios de DB, he seguido `docs/db-release-runbook.md`.
- [ ] Si la migración es no backward-compatible, **NO** hago merge hasta promocionar DB a prod de forma controlada.
- [ ] He documentado plan de rollback cuando aplica.
