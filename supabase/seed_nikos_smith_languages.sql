-- Set languages for test doctors (Nikos + Smith).
-- Prerequisite: column `languages` exists — run `doctors_add_languages.sql` first if you have not.

UPDATE public.doctors
SET languages = ARRAY['English', 'Greek']::text[]
WHERE (
  lower(coalesce(slug, '')) LIKE '%nikos%'
  OR lower(coalesce(name, '')) LIKE '%nikos%'
);

UPDATE public.doctors
SET languages = ARRAY['English', 'Greek']::text[]
WHERE (
  lower(coalesce(slug, '')) LIKE '%smith%'
  OR lower(coalesce(name, '')) LIKE '%smith%'
);

-- Optional: verify
-- SELECT id, name, slug, languages FROM public.doctors
-- WHERE lower(coalesce(name,'')) LIKE '%nikos%' OR lower(coalesce(name,'')) LIKE '%smith%';
