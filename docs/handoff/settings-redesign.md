# Settings redesign (design B1) — backend handoff

Branch `feat/settings-redesign`. The frontend is done; this note lists what it now does
and what it expects from the API and the database. Reference design:
https://claude.ai/artifact/3XYQpTSDQPyn2wWFg8NBmm (board "B1 · Sidebar + clinic cards").

## What changed in the UI

- Settings lives at **`/settings`** (not under the agenda). `/agenda/settings` redirects
  there keeping `?section=`; `/settings` has the same middleware gate as `/agenda`
  (`isProfessionalGatedPath`), the sticky pro header and the boot chrome.
- `/settings` is a sidebar of sections: Availability, Clinics, Services & prices,
  Profile, Contact & phone, Account. The section is in `?section=` (default: Availability),
  switched on the client; edits survive switching sections. One "Save settings" bar shows
  whenever something is unsaved (same `POST /api/doctor-settings` as before).
- Holiday mode sits at the bottom of the sidebar (same fields, same save).
- Clinics: one card per clinic with its online booking switch
  (`POST /api/doctor-online-bookings`, unchanged), a summary of days, hours, break and slot,
  and "Edit hours and slots" to open the editor inside the card.
- "Add clinic" and "Request a change" use the **/register clinic picker** (dark tone):
  DocCy's clinics first, then Google Maps or a pin, plus name and phone for a clinic
  DocCy does not have yet (`components/dashboard/settings/ClinicPicker.tsx`).
- A clinic's address and phone change **only by request** (read-only since #243). The
  name patients see (the join row's label) and the hours stay editable on the card
  ("Edit name and hours").
- The save bar names the sections with unsaved changes (links to each, a dot in the
  sidebar) and offers "Discard changes".
- Any clinic can be removed, the primary one too, as long as one clinic is left.
- Any specialty can be removed instantly, as long as one specialty is left. Adding or
  replacing a specialty is still a request (`POST /api/doctor-specialty-change-request`);
  the "remove" kind is no longer sent from settings.
- Phones: unchanged from #238 (clinic phones read-only, mobile private).

Pure rules the backend should mirror (and can import):
`lib/settings-removal-rules.ts`, `lib/clinic-change-request.ts`.

## Backend to-do

### 1. `DELETE /api/doctor-specialties` (new)

- Auth: the signed-in professional.
- Body: `{ "specialty": "Venereology" }` (an approved label on their profile, any case).
- Rule: refuse when it is their last approved specialty
  (`canRemoveSpecialty` in `lib/settings-removal-rules.ts`).
- Effect: delete the `professional_specialties` row; keep any derived columns in sync
  (same write path as `lib/professional-specialty-writes.ts`).
- 200 `{ "specialties": string[] }` — the approved labels left (the page shows these).
- 400 `{ "message": "Your profile needs at least one specialty." }` for the last one;
  404 `{ "message": … }` when it is not on the profile.

### 2. `POST /api/clinic-change-requests` (new) + table + review

- Auth: the signed-in professional; `locationId` must be theirs.
- Body: `{ "locationId": "<professional_clinics.id>", "changes": ClinicChanges }` — only
  what changes (`lib/clinic-change-request.ts`):
  - `name`, `phone` (8 national digits, `25123456`);
  - `address` + `location` `{ latitude, longitude, placeId, district, town }` (always
    together: the address was picked on Google or pinned);
  - or `clinicId` + `name` + `address`: move this link to an existing DocCy clinic.
  Validate again with `validateClinicChangeRequest` (`lib/clinic-change-request.ts`).
- 201 `{ "request": { "id", "locationId", "changes", "createdAt" } }`.
- 409 `{ "message": … }` if that clinic already has a pending request.
- Needs a table (e.g. `clinic_change_requests`: professional_id, professional_clinic_id,
  clinic_id, requested name/address/phone, status pending|approved|rejected, created_at,
  reviewed_at, reviewed_by, note).
- Founder review (internal dashboard) like specialty requests: approving an address needs
  its pin (lat/lng, place id, district) before it goes live; email the professional on
  approve/reject.
- Page load: pass pending requests to the form as `initial.pendingClinicChanges`
  (`Record<locationId, { changes, createdAt }>`) from `app/agenda/settings/page.tsx`.
  Until then a request only shows "Change in review" until the page reloads.

### 3. `POST /api/clinic-requests` (new) — ask to add a clinic

Since #243 clinics are curated by DocCy and `/api/doctor-locations` is gone, so adding a
clinic is a request too (reviewed like the others).

- Body: `{ "kind": "add", "clinic": NewClinic }` (`lib/clinic-change-request.ts`):
  `{ clinicId, name, location }` to join an existing DocCy clinic, or
  `{ clinicId: null, name, phone, location }` for a clinic DocCy does not have yet.
- 201 `{ "request": { "id", "createdAt" } }`; 400/409 `{ "message" }`.
- On approval: create the `professional_clinics` row (and the `clinics` row for a new
  one, with its phone), email the professional.
- Page load: pass pending ones as `initial.pendingClinicAdds`
  (`{ clinic, createdAt }[]`); the page shows them as "Request in review" cards.

### 4. `DELETE /api/professional-clinics?locationId=` (new) — leave a clinic

- Auth: the signed-in professional; `locationId` = their `professional_clinics.id`.
- Rule: refuse the last clinic (`canRemoveClinic` in `lib/settings-removal-rules.ts`) and
  a clinic with REQUESTED/CONFIRMED appointments (the dialog copy says so).
- Removing the primary promotes the next one (lowest `sort_order`); account settings
  follow the new primary.
- 200 `{}`; 400 `{ "message" }` (the page shows it as is).

## Links elsewhere

`/agenda/settings` is used in `lib/registration-decision-emails.ts` through
`DOCTOR_FIRST_LOGIN_PATH` (now `/settings`); old emails still work through the redirect.
`feat/doctor-dashboard` has its own nav links to `/agenda/settings`: point them at
`/settings` when merging.

## Layout of every pro page

`components/navigation/ResponsiveBottomInset.tsx`: with the pro chrome on, the page sits
in a column one window tall under the 57px header; the page's `<main>` fills it (its
`min-h-screen` is overridden) and the "About DocCy" footer sits at the bottom. Before, a
page that fit still scrolled by header + footer (~146px). Check `feat/doctor-dashboard`'s
agenda "fits the window" layout when merging.

## DB impact of this branch

- Migrations: none.
- Reads: additionally `professional_clinics.id` in `lib/settings-clinic-phones.ts` (to
  show each clinic's phone on its card).
- Writes: none new. The new endpoints above are called by the page and do not exist yet.

## Tests

- Unit: `settings-sections`, `settings-removal-rules`, `clinic-change-request`,
  `settings-clinic-summary` (in `npm run test:unit`).
- e2e: `tests/integration/settings_redesign.integration.spec.ts` (@pr-e2e). The specialty
  removal and clinic change request tests stub the new endpoints with `page.route` and pin
  the request body; once the endpoints exist, the stubs can go.
- Updated for the new layout: address wizard/notice, service menu, public phones, sign-out
  other sessions, registration review, avatar upload, language guard, feedback matrix,
  dashboard, promote practice, prod settings smoke.
