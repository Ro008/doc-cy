-- Documents dynamic expiry used by the API (see lib/proposal-expires-at.ts).
-- When proposal_expires_at <= now(), proposed_slots no longer block in public_doctor_occupied_datetimes.

COMMENT ON COLUMN public.appointments.proposal_expires_at IS
  'Patient must pick before this. Application sets min(now + 24h, first proposed slot start − 2h), floored slightly after now. After expiry, proposed slots are not treated as occupied for public booking.';
