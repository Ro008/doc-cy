-- Apply user-confirmed fixes for midwifery entries.
update public.directory_manual
set
  district = 'Paphos'::public.cyprus_district,
  updated_at = now()
where lower(name) = lower('Athena Kozyraki')
  and is_archived = false;

update public.directory_manual
set
  district = 'Famagusta'::public.cyprus_district,
  updated_at = now()
where lower(name) = lower('Eva Oikonomou')
  and is_archived = false;

delete from public.directory_manual
where lower(name) = lower('Eleni Andreou')
  and is_archived = false;
