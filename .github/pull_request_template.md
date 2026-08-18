## Production database
The `Production DB push` check (and a sticky comment) say whether this PR needs `db:prod:push`.
- [ ] **No prod DB push** — this PR does not change `supabase/migrations/`
- [ ] **Migrations in this PR** — testing first (`npm run db:testing:push`); prod only when explicitly asked (`docs/db-release-runbook.md`)

## 🚀 Checklist de deployment
- [ ] Si hay cambios de DB, he seguido `docs/db-release-runbook.md`.
- [ ] Si la migración es no backward-compatible, **NO** hago merge hasta promocionar DB a prod de forma controlada.
- [ ] He documentado plan de rollback cuando aplica.
