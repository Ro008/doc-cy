-- Rename canonical aesthetics specialty label.

update public.doctors
set specialty = 'Laser & Medical Aesthetics'
where specialty = 'Medical Aesthetics & Laser';

update public.directory_manual
set
  specialty = 'Laser & Medical Aesthetics',
  updated_at = now()
where is_archived = false
  and specialty = 'Medical Aesthetics & Laser';
