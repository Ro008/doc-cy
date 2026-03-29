-- STEP 1 of 2 — Run this alone first, in its own execution (new tab / commit).
-- PostgreSQL does not allow using a newly added enum value in the same transaction.
--
-- After this succeeds, run: appointments_needs_reschedule_step2.sql

ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'NEEDS_RESCHEDULE';
