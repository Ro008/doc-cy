-- Add public SEO slug for manual directory landing pages (/finder/doctor/[slug]).

alter table public.directory_manual
  add column if not exists slug text;

comment on column public.directory_manual.slug is
  'Unique URL slug for public manual directory landing pages. Must not collide with doctors.slug.';

create unique index if not exists directory_manual_slug_unique_lower_idx
  on public.directory_manual (lower(trim(slug)))
  where slug is not null
    and trim(slug) <> ''
    and is_archived = false;
