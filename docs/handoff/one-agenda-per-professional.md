# Handoff: one agenda per professional (frontend done, backend to align)

Branch: `feat/doctor-dashboard`. Decision taken by Rocío (2026-09-30): a professional is one person, so
they can work in several clinics but never in two at the same time. **A visit in any clinic blocks that
time in all of their clinics.** The clinic only decides where the visit happens and which opening hours
apply. Travel time between clinics is out of scope for now.

## What the frontend does now

- **Manual booking modal** (`components/agenda/ManualBookingFlow.tsx`): hides a time if it overlaps any
  blocking visit of the professional, in any clinic. It compares durations (not only start times), with
  the same rules as the API: `REQUESTED` / `CONFIRMED` block their interval; `NEEDS_RESCHEDULE` blocks only
  its live proposed times. Logic and tests: `lib/manual-booking-slots.ts`,
  `tests/unit/manual-booking-slots.test.ts`.
- **Online booking calendar** (`lib/public/doctor-profile-page.tsx`) and **"See other times"**
  (`lib/public/load-reschedule-calendar.ts`): call `public_doctor_occupied_datetimes` **without**
  `p_location_id`, so busy times come from every clinic. No database change needed for this part.

## Backend to change

- `fetchBlockingAppointments` (`lib/appointment-blocking-query.ts`) filters by `location_id` when it gets
  one. Only two callers pass it:
  - `POST /api/appointments` (`app/api/appointments/route.ts`, the `fetchBlockingAppointments` call)
  - `POST /api/appointments/manual` (`app/api/appointments/manual/route.ts`, same)

  Drop the location argument there (and ideally the parameter itself), so the API rejects any overlap
  across clinics with `409`. The other callers (confirm, overlap, alternative-slots, propose-reschedule,
  reschedule select) already check all clinics.
- Today only the unique index on `(doctor_id, appointment_datetime)` stops two visits in different clinics,
  and only when they start at the exact same minute (the API then answers "Slot already taken").
  A 15:00 visit of 45 min in one clinic and a 15:30 one in another still get through the API.

## Database

- No migration required. `p_location_id` in `public_doctor_occupied_datetimes` /
  `public_professionals_occupied_datetimes` is no longer used by the frontend; you can leave it or remove
  it.
