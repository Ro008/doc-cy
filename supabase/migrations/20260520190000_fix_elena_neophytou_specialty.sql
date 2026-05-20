-- Reclassify Elena Neophytou to the canonical aesthetics label.

update public.directory_manual
set
  specialty = 'Medical Aesthetics & Laser',
  updated_at = now()
where is_archived = false
  and lower(name) = lower('Elena Neophytou');
