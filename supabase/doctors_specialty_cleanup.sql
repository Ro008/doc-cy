-- Standard specialties + is_specialty_approved flag (custom "Other" entries stay false until founder approves).
-- Run after deploying app code that reads/writes these fields.

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS is_specialty_approved boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.doctors.is_specialty_approved IS
  'false = custom specialty text pending founder review (Other flow); true = canonical / approved.';

-- ─── Normalize free-text specialties to canonical labels (case-insensitive) ───

UPDATE public.doctors SET specialty = 'General Practice'
WHERE lower(trim(specialty)) IN (
  'general practice', 'gp', 'family medicine', 'family doctor', 'general practitioner',
  'gen practice', 'primary care'
);

UPDATE public.doctors SET specialty = 'Dentistry'
WHERE lower(trim(specialty)) IN (
  'dentistry', 'dentist', 'dental', 'dental surgeon', 'orthodontics', 'orthodontist'
);

UPDATE public.doctors SET specialty = 'Pediatrics'
WHERE lower(trim(specialty)) IN (
  'pediatrics', 'pediatric', 'paediatrics', 'paediatric', 'pediatrician', 'child doctor'
);

UPDATE public.doctors SET specialty = 'Dermatology'
WHERE lower(trim(specialty)) IN (
  'dermatology', 'dermatologist', 'derm', 'skin specialist'
);

UPDATE public.doctors SET specialty = 'Gynecology'
WHERE lower(trim(specialty)) IN (
  'gynecology', 'gynaecology', 'gynecologist', 'gynaecologist', 'obgyn', 'ob/gyn',
  'obstetrics', 'obstetrician'
);

UPDATE public.doctors SET specialty = 'Physiotherapy'
WHERE lower(trim(specialty)) IN (
  'physiotherapy', 'physio', 'physical therapy', 'physiotherapist'
);

UPDATE public.doctors SET specialty = 'Psychology'
WHERE lower(trim(specialty)) IN (
  'psychology', 'psychologist', 'clinical psychology'
);

UPDATE public.doctors SET specialty = 'Psychiatry'
WHERE lower(trim(specialty)) IN (
  'psychiatry', 'psychiatrist'
);

UPDATE public.doctors SET specialty = 'Cardiology'
WHERE lower(trim(specialty)) IN (
  'cardiology', 'cardiologist', 'heart specialist'
);

UPDATE public.doctors SET specialty = 'Orthopedics'
WHERE lower(trim(specialty)) IN (
  'orthopedics', 'orthopaedics', 'orthopedic', 'orthopaedic', 'orthopedic surgeon'
);

UPDATE public.doctors SET specialty = 'Ophthalmology'
WHERE lower(trim(specialty)) IN (
  'ophthalmology', 'ophthalmologist', 'eye doctor', 'eye specialist'
);

UPDATE public.doctors SET specialty = 'ENT'
WHERE lower(trim(specialty)) IN (
  'ent', 'otolaryngology', 'otolaryngologist', 'ear nose throat'
);

UPDATE public.doctors SET specialty = 'Urology'
WHERE lower(trim(specialty)) IN (
  'urology', 'urologist'
);

UPDATE public.doctors SET specialty = 'Endocrinology'
WHERE lower(trim(specialty)) IN (
  'endocrinology', 'endocrinologist'
);

UPDATE public.doctors SET specialty = 'Oncology'
WHERE lower(trim(specialty)) IN (
  'oncology', 'oncologist', 'cancer specialist'
);

UPDATE public.doctors SET specialty = 'Neurology'
WHERE lower(trim(specialty)) IN (
  'neurology', 'neurologist'
);

UPDATE public.doctors SET specialty = 'Gastroenterology'
WHERE lower(trim(specialty)) IN (
  'gastroenterology', 'gastroenterologist', 'gi', 'digestive'
);

UPDATE public.doctors SET specialty = 'Pulmonology'
WHERE lower(trim(specialty)) IN (
  'pulmonology', 'pulmonologist', 'respiratory', 'lung specialist'
);

UPDATE public.doctors SET specialty = 'Rheumatology'
WHERE lower(trim(specialty)) IN (
  'rheumatology', 'rheumatologist'
);

UPDATE public.doctors SET specialty = 'Nephrology'
WHERE lower(trim(specialty)) IN (
  'nephrology', 'nephrologist', 'kidney specialist'
);

-- ─── Flag rows that still do not match the canonical master list (requires app constant sync) ───
UPDATE public.doctors
SET is_specialty_approved = false
WHERE trim(coalesce(specialty, '')) <> ''
  AND specialty NOT IN (
    'General Practice',
    'Dentistry',
    'Pediatrics',
    'Dermatology',
    'Gynecology',
    'Physiotherapy',
    'Psychology',
    'Cardiology',
    'Orthopedics',
    'Ophthalmology',
    'ENT',
    'Urology',
    'Psychiatry',
    'Endocrinology',
    'Oncology',
    'Neurology',
    'Gastroenterology',
    'Pulmonology',
    'Rheumatology',
    'Nephrology'
  );

UPDATE public.doctors
SET is_specialty_approved = true
WHERE specialty IN (
    'General Practice',
    'Dentistry',
    'Pediatrics',
    'Dermatology',
    'Gynecology',
    'Physiotherapy',
    'Psychology',
    'Cardiology',
    'Orthopedics',
    'Ophthalmology',
    'ENT',
    'Urology',
    'Psychiatry',
    'Endocrinology',
    'Oncology',
    'Neurology',
    'Gastroenterology',
    'Pulmonology',
    'Rheumatology',
    'Nephrology'
  );
