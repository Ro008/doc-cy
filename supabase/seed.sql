-- =============================================================================
-- LOCAL SUPABASE ONLY — runs after migrations on:  supabase db reset
-- =============================================================================
-- This is NOT a migration: db:testing:push / db:prod:push never execute this file.
--
-- Pulls in the integration seed (e.g. andreas-nikos, bookable test doctor).
-- Do not run this SQL on hosted Production.
--
-- To see those test doctors in the Finder while developing locally, set in
-- .env.testing.local (or .env.local):
--   NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1
--
-- Prerequisite: at least one row in auth.users (see integration_seed header).
-- =============================================================================

\ir integration_seed_doccy_testing.sql
