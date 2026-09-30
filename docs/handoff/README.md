# Handoff to Livio: `feat/doctor-dashboard`

The frontend of this branch is finished (doctor dashboard, agenda redesign, reschedule follow-up).
Rocío has taken every product decision. Your part is to make the backend and database match the
frontend, run the e2e and open the PR. Where the backend is missing, the UI already calls the contract
endpoint and shows a friendly "not available yet" message.

## Backend and database to build (in this order is fine)

1. **Expired booking requests** — details in the body of commit `f3c8afe`.
   - Allow status `EXPIRED` on `appointments.status`; it must not block slots (like `CANCELLED`).
   - `POST /api/appointments/[id]/close-expired`, body `{ notifyPatient: boolean }`: doctor owns the row;
     only `REQUESTED` rows whose visit start has passed; set `EXPIRED` (never delete); if `notifyPatient`,
     email the patient a short "we couldn't reply in time, book again online" note.
   - The dashboard "No new time chosen" → **Close** also calls it with `notifyPatient: false`, so it must
     also accept `RESCHEDULE_EXPIRED` and lapsed `NEEDS_RESCHEDULE` rows (see 2).
2. **Reschedule follow-up** — [reschedule-follow-up.md](reschedule-follow-up.md).
   `RESCHEDULE_EXPIRED` status, `rescheduled_from` and `reschedule_reminder_sent_at` columns,
   `POST /api/reschedule/[id]/request-other-time`, scheduled job (reminder + expiry), changes to
   propose-reschedule, select, alternative-slots and close-expired. This replaces the "final status for
   lapsed counter-offers" note in commit `05f9726`.
3. **One agenda per professional** — [one-agenda-per-professional.md](one-agenda-per-professional.md).
   Drop the clinic filter in `fetchBlockingAppointments` for `POST /api/appointments` and
   `POST /api/appointments/manual`. No migration.
4. Small fix: stale comment in `app/api/appointments/route.ts` (the 23505 branch) says a
   `NEEDS_RESCHEDULE` row still holds its original instant in the unique index; it no longer does
   (commit `05f9726`).

## Database changes, all together

| Change | From |
|---|---|
| Status value `EXPIRED` | 1 |
| Status value `RESCHEDULE_EXPIRED` | 2 |
| `appointments.rescheduled_from timestamptz null` | 2 |
| `appointments.reschedule_reminder_sent_at timestamptz null` | 2 |

Nothing else in the branch touches the database. Please state this DB impact in the PR.

## Tests

- Unit: `npm run test:unit` is green (988 tests at handoff, after merging master with #238).
- e2e: run locally on 2026-09-30 exactly like the PR lanes (throwaway Supabase stack, `@pr-email|@pr-e2e`,
  Desktop Large) plus `doctor_dashboard`, `doctor_cancel_upcoming` and `doctor_break_slots`.
  - Specs that assumed the old agenda/landing were updated on this branch (agenda title row, landing on
    `/dashboard`, `?manual=1` after reload, phone agenda).
  - Still failing locally, but they fail the same way on `master` in that setup and pass in GitHub CI, so
    they are not caused by this branch: `doctor_account_access` (3), `applicant_account_menu:133`,
    `first_login_trial_notice:85`, `registration_request_review:509`,
    `registration_status_and_reapply:121`, `doctor_break_slots:20`. `registration_contact_unique` only
    fails when every lane shares one server (per-IP rate limit); it passes on its own.
  - Once your backend changes land, run the PR CI and the three specs above again.

## When the PR is ready

Remove the "Branch handoff" section from `CLAUDE.md` before merging, so it does not reach `master`.

## Not in scope

Do not build these unless Rocío asks: the doctor withdrawing a pending proposal, spreading out the
proposed times, an updating .ics invite, travel time between clinics, and the optional items at the end
of commit `f3c8afe` (request log entry, expired requests in the monthly digest).
