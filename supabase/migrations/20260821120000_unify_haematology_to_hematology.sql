-- Unify GeSY Haematology (HEM/AEHEM/ISHEM) with Hematology (LABH).
-- Canonical DocCy category: Hematology.

UPDATE public.doctors
SET specialty = 'Hematology'
WHERE lower(trim(specialty)) = 'haematology';

UPDATE public.directory_manual
SET
  specialty = 'Hematology',
  updated_at = now()
WHERE lower(trim(specialty)) = 'haematology';

UPDATE public.directory_manual d
SET
  specialties = (
    SELECT ARRAY(
      SELECT v.mapped
      FROM (
        SELECT
          CASE
            WHEN lower(trim(s)) IN ('haematology', 'hematology') THEN 'Hematology'
            ELSE s
          END AS mapped,
          MIN(ord) AS min_ord
        FROM unnest(d.specialties) WITH ORDINALITY AS t(s, ord)
        GROUP BY 1
      ) v
      ORDER BY v.min_ord
    )
  ),
  updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM unnest(d.specialties) AS s
  WHERE lower(trim(s)) IN ('haematology', 'hematology')
);
