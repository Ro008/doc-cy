-- Manual bookings (the professional types in a phone or walk-in patient) need only name,
-- phone and reason; first visit, gender and birth date become optional (Rocío, 2026-10-06).
-- Online bookings keep requiring all of them plus the email. The columns were already
-- nullable: only this check changes. Rows without booking_source (before 2026-10-04) stay
-- unchecked, as before.

alter table public.appointments
  drop constraint if exists appointments_booking_fields_check;

alter table public.appointments
  add constraint appointments_booking_fields_check
  check (
    booking_source is null
    or (
      nullif(btrim(reason), '') is not null
      and (
        booking_source = 'manual'
        or (
          patient_gender is not null
          and patient_birthdate is not null
          and is_new_patient is not null
          and nullif(btrim(patient_email), '') is not null
        )
      )
    )
  );
