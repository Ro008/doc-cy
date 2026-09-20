-- Retire the automatic signup-dedupe table along with the flow that fed it.
--
-- directory_duplicate_suggestions backed an automation that, when a doctor sent a
-- signup request, tried to work out by itself whether that doctor was already in the
-- scraped GeSY directory. That process is no longer how DocCy works:
--   * "Claim this profile" on a directory card now names its own target, and the
--     internal dashboard shows which listing the registration claimed;
--   * a plain "Join as a professional" is checked by hand against the directory.
--
-- So the suggestions were guesses nobody consulted any more. The table holds 0 rows on
-- Testing and Production -- not because nothing wrote to it, but because the generator
-- (buildDuplicateSuggestions, name 0.7 + specialty 0.2 + district 0.1 over a 0.85
-- threshold) ran on each /internal/directory render and, with two registered
-- professionals in Production, never cleared the bar.
--
-- Removed with it: the generator and its panel on /internal/directory, the
-- /api/internal/directory-duplicates/{dismiss,merge} routes, and the status bookkeeping
-- in the verification and pending-registration-twin routes. Both of those keep their
-- real job, absorb_unregistered_into_registered, which is also used by the claim flow
-- and is deliberately NOT dropped here. "Keep both" in the twin review no longer writes
-- a tombstone -- with no suggestions left to suppress, the decision is to do nothing.
--
-- The table also carried INSERT/UPDATE/DELETE grants to anon and authenticated, so this
-- closes the same write surface 20260919085031 closed for clinics.
--
-- Guarded: refuse to drop if rows ever appear, rather than destroying them silently.
-- Idempotent: the to_regclass check makes a re-run a no-op.
DO $$
DECLARE
  v_rows bigint;
BEGIN
  IF to_regclass('public.directory_duplicate_suggestions') IS NULL THEN
    RAISE NOTICE 'public.directory_duplicate_suggestions already dropped; nothing to do.';
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.directory_duplicate_suggestions' INTO v_rows;
  IF v_rows > 0 THEN
    RAISE EXCEPTION 'public.directory_duplicate_suggestions holds % row(s); refusing to drop. Investigate before re-running.', v_rows;
  END IF;

  DROP TABLE public.directory_duplicate_suggestions;
  RAISE NOTICE 'public.directory_duplicate_suggestions dropped.';
END $$;
