-- Normalize doctors.languages[] to canonical Title Case labels used by the app.
-- Run once in Supabase SQL Editor after deploying language standardization.
-- Adjust mappings if your data uses other variants.
--
-- ¿Tienes que ejecutarlo? Opcional: la app ya puede mostrar bien typos vía lib/cyprus-languages
-- (p. ej. Frenchh → French) al pintar el perfil. Este script además corrige los valores
-- guardados en la base para informes, filtros y futuras ediciones.

CREATE OR REPLACE FUNCTION public._doccy_normalize_lang_token(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(raw))
    WHEN 'greek' THEN 'Greek'
    WHEN 'ellinika' THEN 'Greek'
    WHEN 'english' THEN 'English'
    WHEN 'eng' THEN 'English'
    WHEN 'en' THEN 'English'
    WHEN 'turkish' THEN 'Turkish'
    WHEN 'russian' THEN 'Russian'
    WHEN 'spanish' THEN 'Spanish'
    WHEN 'espanol' THEN 'Spanish'
    WHEN 'español' THEN 'Spanish'
    WHEN 'french' THEN 'French'
    WHEN 'frenchh' THEN 'French'
    WHEN 'français' THEN 'French'
    WHEN 'german' THEN 'German'
    WHEN 'deutsch' THEN 'German'
    WHEN 'italian' THEN 'Italian'
    WHEN 'italiano' THEN 'Italian'
    WHEN 'arabic' THEN 'Arabic'
    WHEN 'romanian' THEN 'Romanian'
    WHEN 'bulgarian' THEN 'Bulgarian'
    WHEN 'other' THEN 'Other'
    ELSE initcap(trim(raw))
  END;
$$;

UPDATE public.doctors d
SET languages = sub.norm
FROM (
  SELECT
    t.id,
    array_agg(DISTINCT t.norm ORDER BY t.norm) AS norm
  FROM (
    SELECT
      doc.id,
      public._doccy_normalize_lang_token(x) AS norm
    FROM public.doctors doc,
         unnest(coalesce(doc.languages, array[]::text[])) AS x
    WHERE length(trim(x)) > 0
  ) t
  GROUP BY t.id
) sub
WHERE d.id = sub.id
  AND sub.norm IS NOT NULL
  AND cardinality(sub.norm) > 0;

-- Optional: drop helper after migration
-- DROP FUNCTION IF EXISTS public._doccy_normalize_lang_token(text);

COMMENT ON FUNCTION public._doccy_normalize_lang_token(text) IS
  'Internal: maps legacy language strings toward DocCy canonical labels.';
