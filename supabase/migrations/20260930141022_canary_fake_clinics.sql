-- Canary listings get their own fake clinic, so their phone button comes back
-- (the phone is now read from clinics.phone only; the canaries had no clinic).
-- Fingerprints live in lib/directory-canaries.ts: clinic id = c041801N-..., phone
-- = the canary's reserved number (8 digits, like every clinic phone).
-- Keyed on the canary professionals that exist; idempotent; touches no other row.

INSERT INTO public.clinics (
  id, name, slug, district, address, phone, address_maps_link, latitude, longitude
)
SELECT
  ('c041801' || substr(p.id::text, 7, 1) || '-d0cc-4a01-900' || substr(p.id::text, 7, 1)
    || '-cafebabe100' || substr(p.id::text, 7, 1))::uuid,
  p.name,
  p.slug || '-clinic',
  p.district,
  p.address,
  right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 8),
  p.address_maps_link,
  p.latitude,
  p.longitude
FROM public.professionals p
WHERE p.id::text ~ '^c04180[1-6]0-d0cc-4a01-800[1-6]-cafebabe000[1-6]$'
  AND p.is_registered IS NOT TRUE
  AND p.district IS NOT NULL
  AND coalesce(p.address, '') <> ''
ON CONFLICT (id) DO NOTHING;

-- Separate statement: it must see the clinics inserted above.
INSERT INTO public.professional_clinics (professional_id, clinic_id, is_primary)
SELECT p.id, c.id, true
FROM public.professionals p
JOIN public.clinics c
  ON c.id::text = 'c041801' || substr(p.id::text, 7, 1) || '-d0cc-4a01-900' || substr(p.id::text, 7, 1)
    || '-cafebabe100' || substr(p.id::text, 7, 1)
WHERE p.id::text ~ '^c04180[1-6]0-d0cc-4a01-800[1-6]-cafebabe000[1-6]$'
  AND p.is_registered IS NOT TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.professional_clinics pc WHERE pc.professional_id = p.id
  )
ON CONFLICT DO NOTHING;
