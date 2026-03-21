-- Make a doctor's public booking page live at /[slug]
-- Example: Tasos Smith — adjust slug if yours differs (check Table Editor → doctors → slug column).

UPDATE public.doctors
SET status = 'verified'
WHERE lower(slug) = 'tasos-smith';

-- Verify
-- SELECT id, name, slug, status FROM public.doctors WHERE lower(slug) = 'tasos-smith';
