-- STEP 1 of 2 — Run this file ALONE in the Supabase SQL Editor and click Run once.
--
-- PostgreSQL does not allow using a newly added enum label in the same transaction
-- as ALTER TYPE ... ADD VALUE (error 55P04). After this succeeds, run
-- appointments_appointment_request.sql in a NEW query.
--
-- PostgreSQL 15+ (Supabase): IF NOT EXISTS. If a line errors with "already exists",
-- skip that line and continue.

ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'CANCELLED';
