-- Appointments flow, M1 (backward-compatible: only adds). Decisions: work plan item 1,
-- build plan `.claude/build-plan-appointments.md` Phase 1. M2 (after the merge and the
-- Vercel deploy) drops location_id, the dead columns and the old statuses.
--
-- 1. appointments: new columns; clinic_id (→ clinics) backfilled from location_id;
--    required booking fields enforced only when booking_source is set (legacy rows
--    stay valid); statuses DECLINED / EXPIRED and attendance 'attended' allowed.
-- 2. appointment_drafts: unconfirmed online requests (emailed link, 30 min).
-- 3. appointment_links: patient links (proposal / cancel / review), token stored hashed.
-- 4. professional_reviews: one review per visit.
-- 5. professional_settings.patient_cancel_notice_hours (12 / 24 / 48, default 24).
-- 6. professional_clinics.pause_notice_dismissed_at, cleared when the pause changes.
--
-- New tables: RLS on, no policies, nothing granted to anon / authenticated; the app
-- reads and writes them with the service role.

-- 1. appointments ---------------------------------------------------------------

alter table public.appointments
  add column if not exists booking_source text,
  add column if not exists clinic_id uuid,
  add column if not exists patient_gender text,
  add column if not exists patient_birthdate date,
  add column if not exists decline_reason text,
  add column if not exists cancelled_by text,
  add column if not exists cancel_reason text,
  add column if not exists professional_notes text,
  add column if not exists visit_reminder_sent_at timestamptz,
  add column if not exists proposal_reminder_sent_at timestamptz,
  add column if not exists review_requested_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_clinic_id_fkey') then
    alter table public.appointments
      add constraint appointments_clinic_id_fkey
      foreign key (clinic_id) references public.clinics (id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_booking_source_check') then
    alter table public.appointments
      add constraint appointments_booking_source_check
      check (booking_source is null or booking_source in ('online', 'manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_patient_gender_check') then
    alter table public.appointments
      add constraint appointments_patient_gender_check
      check (patient_gender is null or patient_gender in ('female', 'male', 'prefer_not_to_say'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_patient_birthdate_check') then
    alter table public.appointments
      add constraint appointments_patient_birthdate_check
      check (patient_birthdate is null or patient_birthdate >= date '1900-01-01');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_cancelled_by_check') then
    alter table public.appointments
      add constraint appointments_cancelled_by_check
      check (cancelled_by is null or cancelled_by in ('patient', 'professional'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_professional_notes_check') then
    alter table public.appointments
      add constraint appointments_professional_notes_check
      check (professional_notes is null or char_length(professional_notes) <= 2000);
  end if;
  -- Booking fields: required for every row that says where it came from. Rows created
  -- before this migration have no booking_source and are not checked.
  if not exists (select 1 from pg_constraint where conname = 'appointments_booking_fields_check') then
    alter table public.appointments
      add constraint appointments_booking_fields_check
      check (
        booking_source is null
        or (
          patient_gender is not null
          and patient_birthdate is not null
          and is_new_patient is not null
          and nullif(btrim(reason), '') is not null
          and (booking_source = 'manual' or nullif(btrim(patient_email), '') is not null)
        )
      );
  end if;
end
$$;

create index if not exists appointments_clinic_id_idx
  on public.appointments (clinic_id) where clinic_id is not null;

-- Statuses: add DECLINED and EXPIRED (the old values stay until M2). Production keeps
-- status as the enum public.appointment_status (like 20260525140000); Testing has text
-- with a check.
do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.appointments'::regclass
      and attname = 'status'
      and atttypid = to_regtype('public.appointment_status')
  ) then
    alter type public.appointment_status add value if not exists 'DECLINED';
    alter type public.appointment_status add value if not exists 'EXPIRED';
  else
    alter table public.appointments drop constraint if exists appointments_status_check;
    alter table public.appointments
      add constraint appointments_status_check
      check (status = any (array[
        'REQUESTED', 'PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'COMPLETED',
        'NEEDS_RESCHEDULE', 'DECLINED', 'EXPIRED'
      ]::text[]));
  end if;
end
$$;

-- Attendance: 'attended' joins 'no_show'.
alter table public.appointments drop constraint if exists appointments_attendance_check;
alter table public.appointments
  add constraint appointments_attendance_check
  check (attendance is null or attendance in ('attended', 'no_show'));

-- clinic_id backfill, rule-driven: from the clinic link; for rows without one, only
-- when the professional has exactly one clinic.
update public.appointments a
set clinic_id = pc.clinic_id
from public.professional_clinics pc
where pc.id = a.location_id
  and a.clinic_id is distinct from pc.clinic_id;

update public.appointments a
set clinic_id = only_clinic.clinic_id
from (
  select professional_id, min(clinic_id::text)::uuid as clinic_id
  from public.professional_clinics
  group by professional_id
  having count(*) = 1
) as only_clinic
where a.location_id is null
  and a.clinic_id is null
  and only_clinic.professional_id = a.professional_id;

-- 2. appointment_drafts -----------------------------------------------------------

create table if not exists public.appointment_drafts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  appointment_datetime timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 480),
  patient_name text not null check (nullif(btrim(patient_name), '') is not null),
  patient_email text not null check (nullif(btrim(patient_email), '') is not null),
  patient_phone text not null check (nullif(btrim(patient_phone), '') is not null),
  patient_gender text not null check (patient_gender in ('female', 'male', 'prefer_not_to_say')),
  patient_birthdate date not null check (patient_birthdate >= date '1900-01-01'),
  is_new_patient boolean not null,
  reason text not null check (nullif(btrim(reason), '') is not null),
  token_hash text not null unique,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  appointment_id uuid references public.appointments (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.appointment_drafts is
  'Online booking requests waiting for the patient to confirm the emailed link (30 min). Not appointments: they hold no time. Service role only.';

create index if not exists appointment_drafts_email_created_idx
  on public.appointment_drafts (lower(patient_email), created_at);
create index if not exists appointment_drafts_phone_created_idx
  on public.appointment_drafts (patient_phone, created_at);
create index if not exists appointment_drafts_expires_idx
  on public.appointment_drafts (expires_at) where confirmed_at is null;

-- 3. appointment_links ------------------------------------------------------------

create table if not exists public.appointment_links (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  purpose text not null check (purpose in ('proposal', 'cancel', 'review')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.appointment_links is
  'Links emailed to patients (pick a proposed time, cancel, review). Token stored hashed; single use (used_at); expiring. Service role only.';

create index if not exists appointment_links_appointment_purpose_idx
  on public.appointment_links (appointment_id, purpose);

-- 4. professional_reviews ---------------------------------------------------------

create table if not exists public.professional_reviews (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete restrict,
  appointment_id uuid not null unique references public.appointments (id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (nullif(btrim(comment), '') is not null and char_length(comment) <= 2000),
  reviewer_name text not null check (nullif(btrim(reviewer_name), '') is not null),
  reviewer_email text not null check (nullif(btrim(reviewer_email), '') is not null),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);

comment on table public.professional_reviews is
  'One review per attended visit. Public display: first name + last initial, never reviewer_email. Founders hide with status. Service role only.';

create index if not exists professional_reviews_professional_idx
  on public.professional_reviews (professional_id, created_at desc);

-- Access for the three new tables: service role only.
alter table public.appointment_drafts enable row level security;
alter table public.appointment_links enable row level security;
alter table public.professional_reviews enable row level security;

revoke all on table public.appointment_drafts from public, anon, authenticated;
revoke all on table public.appointment_links from public, anon, authenticated;
revoke all on table public.professional_reviews from public, anon, authenticated;
grant select, insert, update, delete on table public.appointment_drafts to service_role;
grant select, insert, update, delete on table public.appointment_links to service_role;
grant select, insert, update, delete on table public.professional_reviews to service_role;

-- 5. professional_settings.patient_cancel_notice_hours ------------------------------

alter table public.professional_settings
  add column if not exists patient_cancel_notice_hours integer not null default 24;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'professional_settings_cancel_notice_check') then
    alter table public.professional_settings
      add constraint professional_settings_cancel_notice_check
      check (patient_cancel_notice_hours in (12, 24, 48));
  end if;
end
$$;

-- 6. professional_clinics.pause_notice_dismissed_at ---------------------------------

alter table public.professional_clinics
  add column if not exists pause_notice_dismissed_at timestamptz;

create or replace function public.professional_clinics_reset_pause_notice()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.pause_online_bookings is distinct from old.pause_online_bookings then
    new.pause_notice_dismissed_at := null;
  end if;
  return new;
end
$$;

revoke all on function public.professional_clinics_reset_pause_notice() from public, anon, authenticated;

drop trigger if exists professional_clinics_reset_pause_notice on public.professional_clinics;
create trigger professional_clinics_reset_pause_notice
  before update of pause_online_bookings on public.professional_clinics
  for each row execute function public.professional_clinics_reset_pause_notice();
