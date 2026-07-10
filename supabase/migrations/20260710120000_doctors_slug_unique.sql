-- Ensure public profile slugs are unique (case-insensitive).
-- Rename legacy duplicates before adding the unique index.

WITH ranked AS (
  SELECT
    id,
    slug,
    row_number() OVER (
      PARTITION BY lower(trim(slug))
      ORDER BY id
    ) AS rn
  FROM public.doctors
  WHERE slug IS NOT NULL
    AND trim(slug) <> ''
)
UPDATE public.doctors AS d
SET slug = left(
  trim(both '-' from concat(r.slug, '-', substr(replace(d.id::text, '-', ''), 1, 6))),
  60
)
FROM ranked AS r
WHERE d.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS doctors_slug_unique_lower_idx
  ON public.doctors (lower(trim(slug)))
  WHERE slug IS NOT NULL AND trim(slug) <> '';
