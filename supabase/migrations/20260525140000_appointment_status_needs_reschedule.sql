-- Reschedule counter-offer status (enum projects only; text status columns skip this).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'appointment_status'
  ) THEN
    ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'NEEDS_RESCHEDULE';
  END IF;
END $$;
