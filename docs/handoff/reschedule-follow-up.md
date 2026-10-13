# Handoff: reschedule follow-up (frontend done, backend to build)

Branch: `feat/doctor-dashboard`. The frontend below is built and behaves as described. Where the backend
does not exist yet, the UI calls the contract endpoint anyway and shows a friendly "not available yet"
message (404 / 405 / 501). Your part is to make the backend and database match. Every contract also sits
as a comment at the top of the file named in each section.

Principles behind the decisions (taken by Rocío):
- **Online booking first.** Every dead end sends the patient to the professional's online booking. Never
  point them at a phone call.
- **Nothing silently disappears.** If a patient does not pick a new time, they are told and the doctor
  sees it in the dashboard.

## 1. Doctor proposes new times (agenda modal) — `components/agenda/AgendaRealtime.tsx`

What the UI does now:
- Reason textarea capped at 4000 characters with a counter (same limits as the API: 10–4000).
- Before sending, it says the original time is freed straight away and until when the patient can choose
  (computed with the same `computeProposalExpiresAt` the server uses; see `lib/reschedule-proposal.ts`).
- After sending, if the times the server returned differ from the preview, a warning lists the times
  that were actually sent.

Backend to change:
- `POST /api/appointments/[id]/propose-reschedule` recomputes the three times on send. Accept the
  previewed ones instead: body `proposedSlots: string[3]` (UTC ISO), check each is still free and use
  them; `409` if one was taken. The frontend already warns when they differ, so this is safe to ship in
  either order.
- The email to the patient can fail silently (the route logs and returns 200). Return an error the UI can
  show, or roll the status back, so a proposal is never "sent" without the patient being told.
- Add a status guard to the update: `.eq("status", <status read before>)` so a double send or a
  concurrent change cannot overwrite a newer state. Same for `POST /api/reschedule/[id]/select`
  (`.eq("status", "NEEDS_RESCHEDULE")`).
- Reject rescheduling a confirmed visit that already happened (the UI hides it; the API should too).

## 2. Patient picks another time — `/reschedule/[id]` (the page the email link opens)

Files: `components/reschedule/ReschedulePickClient.tsx`, `app/reschedule/[id]/page.tsx`,
`components/doctor/BookingSection.tsx` (`rescheduleOf` mode), `lib/public/load-reschedule-calendar.ts`,
contract in `lib/reschedule-other-times.ts`.

What the UI does now:
- Under the three proposed times: "None of these work for you?" → **See other times** opens the same
  online booking calendar as the profile (same clinic, hours and busy times). The patient picks a slot and
  **Request this time** sends it; no contact form (we already know them). Success screen: "Request sent".
- Expired / revoked / no-times / already-sorted panels all offer **Book a new time online** (profile).

Backend to build — `POST /api/reschedule/[id]/request-other-time`:
- Body `{ token: string, appointmentLocal: "YYYY-MM-DDTHH:mm" }` (Cyprus wall clock, like
  `POST /api/appointments`).
- Token must match `reschedule_access_token`; the row must be `NEEDS_RESCHEDULE` (live **or** lapsed
  proposal) or `RESCHEDULE_EXPIRED` → otherwise 403 / 400.
- The time must be bookable like a public booking (hours, horizon, minimum notice, overlap excluding this
  appointment) → otherwise 409 (the UI says "That time was just booked").
- On success **update the same row** (no new appointment): `status = REQUESTED`,
  `appointment_datetime = chosen time`, `rescheduled_from = previous appointment_datetime`,
  `proposed_slots = []`, `proposal_expires_at = null`, `reschedule_access_token = null`. Keep patient
  fields, reason and location. This releases the three held times, and the doctor sees it in
  "Needs your answer" like any request (1-click approve).
- Send `sendDoctorPatientAskedOtherTimeEmail` (`lib/reschedule-emails.ts`).
- Response `200 { appointment: { id, appointment_datetime, status: "REQUESTED" } }`.

Database:
- New column `appointments.rescheduled_from timestamptz null`. The dashboard already selects it and
  falls back while it does not exist (`app/dashboard/(home)/page.tsx`); pending requests with it show
  "Asked for another time · was Tue 29 Sep, 15:00".

## 3. Patient does not answer — dashboard follow-up

Files: `lib/reschedule-follow-up.ts` (contract), `components/dashboard/DoctorDashboard.tsx`,
`app/dashboard/appointments/[id]/page.tsx`, `components/dashboard/AppointmentReviewClient.tsx`
(`context="noNewTime"`).

What the UI does now:
- "Needs your answer" has a **No new time chosen** block. Until the backend stores a final status, it
  lists `NEEDS_RESCHEDULE` rows whose `proposal_expires_at` passed in the last 14 days. The dashboard
  query now also loads `NEEDS_RESCHEDULE` rows whose original time is in the past.
- **Suggest other times** opens the review page in a "No new time chosen" variant: only suggesting new
  times (no accept, keep or decline).
- **Close** dismisses it without emailing the patient (they were already told when it expired).

Backend to build:
- **Final status `RESCHEDULE_EXPIRED`**, set by a scheduled job when a proposal expires with no choice.
  It holds nothing in the calendar. After adding it to the enum, add `status.eq.RESCHEDULE_EXPIRED` to
  the dashboard query (`loadDashboardAppointments`); `isRescheduleWithoutAnswer` already recognises it.
- **Close** calls the existing close-expired contract (`closeExpiredRequestPath` in
  `lib/appointment-status.ts`) with `{ notifyPatient: false }` → row becomes `EXPIRED`. That endpoint
  must accept `RESCHEDULE_EXPIRED` and lapsed `NEEDS_RESCHEDULE` rows.
- **Suggest other times**: `GET …/alternative-slots` and `POST …/propose-reschedule` must accept
  `RESCHEDULE_EXPIRED` and lapsed `NEEDS_RESCHEDULE` rows (today only `REQUESTED` / `CONFIRMED`; the UI
  shows "isn't available yet" meanwhile).

## 4. Emails — `lib/reschedule-emails.ts`

Built (subject, text, HTML) with ready-to-call senders; you only schedule and call them:
- `sendPatientRescheduleReminderEmail`: when `isRescheduleReminderDue(...)` (3 h before the deadline,
  once). Store `appointments.reschedule_reminder_sent_at timestamptz null` (new column) and reset it on
  every new proposal.
- `sendPatientRescheduleExpiredEmail`: at expiry, together with setting `RESCHEDULE_EXPIRED`. CTA
  "Book a new time online" → public profile.
- `sendDoctorPatientAskedOtherTimeEmail`: from request-other-time (section 2).
- The existing proposal email (`lib/send-patient-reschedule-proposal-email.ts`) now also says any other
  free time can be picked from the same link.

Scheduled job (Vercel cron, like `monthly-digest`), every ~15 min over `NEEDS_RESCHEDULE` rows: reminder
when due; at `proposal_expires_at <= now` → `RESCHEDULE_EXPIRED` + expired email.

## Summary of database changes

| Change | Why |
|---|---|
| Status value `RESCHEDULE_EXPIRED` | Proposal lapsed with no choice (section 3) |
| `appointments.rescheduled_from timestamptz null` | Patient picked another time (section 2) |
| `appointments.reschedule_reminder_sent_at timestamptz null` | Send the reminder once (section 4) |

## Not in scope here

Improvements Rocío has not decided yet. Do not build them unless she asks:
- The doctor withdrawing a pending proposal.
- The three proposed times being more spread out (today: the first three free slots after the original
  time).
- An updating calendar invite (.ics with the same UID and a higher SEQUENCE).
