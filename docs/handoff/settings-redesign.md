# Settings redesign — handoff to backend (START HERE)

Branch: `feat/settings-redesign` · Frontend: **final** (Rocío, 2026-10-01; last changes
2026-10-09) · Backend and database: **Livio decides**. Up to date with `master` on
2026-10-09 (incl. #272, appointments M2).

This file is for Livio and for the AI assistant working with him. It says what the
frontend on this branch now does and what it calls or reads that the backend does not
provide yet. It does **not** say how to build the backend: tables, columns, endpoints'
internals, naming and whether to keep, rename or reshape any contract are Livio's call.
Where the UI calls something, the shape it sends is listed so you know what exists today;
if you choose a different shape, change the call site named next to it (the frontend is
small and isolated for exactly that).

Reference design (private canvas): https://claude.ai/artifact/3XYQpTSDQPyn2wWFg8NBmm
(board "B1 · Sidebar + clinic cards").

---

## 1. TL;DR for the assistant taking over

1. Read sections 2 (what changed) and 3 (what the UI calls that does not exist yet).
2. Every call that waits for the backend is marked in code with
   `EXPECTED TO FAIL until Livio builds …` and shows the doctor a message saying so
   (`lib/settings-backend-pending.ts`). `grep -rn "EXPECTED TO FAIL" components lib`
   lists them all.
3. When an endpoint exists, remove its entry from `BACKEND_PENDING` (and the file once
   empty) and drop the matching `page.route` stub in
   `tests/integration/settings_redesign.integration.spec.ts`.
4. Section 4 lists open decisions that are yours; section 6 lists merge notes with
   `feat/doctor-dashboard`.
5. No migrations on this branch. Nothing here writes anything new to the database.
   One migration is needed from you: booking limits move to `professional_clinics`
   (3.7).

---

## 2. What the frontend now does

### Page and navigation
- Settings lives at **`/settings`** (`app/settings/page.tsx`), not under the agenda.
  `/agenda/settings` redirects there keeping `?section=`. Same middleware gate as
  `/agenda` (`isProfessionalGatedPath`).
- A sidebar of sections, kept in `?section=` (default `profile`; Livio, 2026-10-09):
  Profile · Clinics · Services & prices · Promote | Plan & billing ·
  Account (`lib/settings-sections.ts`). A thin line on wide screens sets the last two
  apart. Old `?section=availability` and `?section=contact` links open Clinics. The dashboard's paused-clinic
  notice links to `?section=clinics`.
- Old `/settings?section=account#promote-practice` links land on Promote.

### One save rule (frontend only; same API)
- No page-wide "Save settings". Booking limits, languages and turning holiday mode off
  save at once; a clinic's hours, the bio and holiday dates have their own
  Save / Cancel (`lib/settings-save-groups.ts`). The personal mobile is not part of it:
  its card in Account saves through its own routes (below).
- Still `POST /api/doctor-settings`, unchanged. That API replaces everything it is sent,
  so each save sends **the last saved settings with only that block changed**. Expect
  more, smaller saves than before. If you ever make that API accept partial updates,
  `buildSettingsSavePayload` is the one place to adapt.

### Clinics
- One card per clinic: status, online booking switch (`POST /api/doctor-online-bookings`,
  unchanged), summary of days/hours/break/slot, "Edit hours" editor in the card.
- **Booking limits per clinic** on each card (how far ahead, minimum notice, online
  cancellation deadline), saved at once, plus "Apply to all my clinics" when there is
  more than one. All clinics are equal; there is no primary in this. Until your
  migration a change shows on every clinic and the card says so (section 3.7,
  `lib/settings-clinic-limits.ts`, `components/dashboard/settings/ClinicBookingLimits.tsx`).
- A clinic's **name, address and phone change only by request** ("Request a change").
  Only hours are editable.
- **The clinic's phone is on its card** (Livio, 2026-10-10), shown as "+357 25 123456",
  with its own "Request a change" next to it. That opens a phone field in the card (a
  Cyprus landline or mobile only, grouped as she types) and sends
  `POST /api/clinic-change-requests` with `{ locationId, changes: { phone } }`, the
  contract of section 3.2 (backend pending). **Founders approve every clinic phone
  change, however many people work at the clinic** (Livio, 2026-10-10). Then the card
  shows "Change in review" (`components/dashboard/settings/ClinicPhoneField.tsx`).
- **One clinic name everywhere: DocCy's `clinics.name`.** A doctor at a shared clinic
  must not rename it for their patients. `professionalClinicRowToLocation`
  (`lib/professional-clinic-locations.ts`) now maps `label` from `clinics.name` and only
  falls back to `professional_clinics.label` when the clinic has no name. This is a
  shared read mapping, so settings, agenda, booking, profile, finder **and emails** all
  show the DocCy name now. Settings no longer sends `label`.
- "Add clinic" and "Request a change" reuse the /register clinic picker (DocCy clinics
  first, then Google Maps or a pin) — `components/dashboard/settings/ClinicPicker.tsx`.
- Any clinic can be removed, the primary too, while one is left
  (`lib/settings-removal-rules.ts`).

### Availability (removed, Livio 2026-10-09)
- The section only repeated each clinic card's status (and the dashboard already says
  which clinics are paused), so it is gone. Clinics is the default section; old
  `?section=availability` links land there.
- Clinics now shows the "Holiday mode is on until …" banner and, on phones, the holiday
  mode card (the sidebar keeps it on wide screens). Unsaved holiday dates mark Clinics.
- With pro access ended (`initial.accessEnded`, master's `loadProAccessEnded`), every
  clinic's switch is off and disabled and Clinics says why.

### Profile
- Specialties: removing one is instant (✕ on the chip) while one is left. Asking for a
  new one is a request (section 3.6): a change is "add the new one, remove the old one
  once approved". Master dropped the old specialty requests (E3) and showed "Contact us"
  meanwhile; this branch keeps the redesigned form and calls the NEW requests instead.
  `tests/unit/legacy-specialty-claim-outreach-removed.test.ts` was updated to match.
- The pending request shows as an "In review" chip with ✕ to cancel it (section 3.5).
  The page loads no pending request today (`initial.pendingSpecialtyChange` is unset).
- "Preview profile" link in Profile and Services. It opens a new tab, so this tab shows
  "Opening…" and then a toast.

### Services & prices
- A short "What are services?" block above the list says what they are and how they
  help patients (only claims that are true today: they are on the profile with prices;
  patients cannot pick one when booking yet, Notion task "Booking: el paciente elige un
  servicio y el doctor lo ve en la cita").

### Contact & phone (removed, Livio 2026-10-10)
- Each clinic's phone is on its card in Clinics and the personal mobile is in Account,
  so the section is gone (`components/dashboard/PhoneNumbersSettings.tsx` deleted).

### Promote (frontend only)
- QR, booking link (`mydoccy.com/<slug>`, Copy link), scripts that fold.
- "Print booking sign" prints design A on A5 (`lib/booking-sign.ts`): DocCy logo, the
  name **as on the profile (no "Dr" added)** and the approved primary specialty.

### Plan & billing (frontend only)
- Reads `professionals.pro_access_until` and `subscription_tier`
  (`lib/settings-plan.ts`): countdown to the end of the free period, the terms after it
  (Founding Member €19/month locked for life, otherwise €49/month), "Nothing to pay
  today". No payment form exists; it is read-only.
- The Founding Member badge no longer opens a pop-up: outside Settings it links to
  Plan & billing; inside Settings it is a plain label. The founders' direct line is the
  "Write to the founders" button (opens the feedback form). The badge was removed from
  the agenda header (as on `feat/doctor-dashboard`).

### Account
- "Sign-in & security": the email with "Change email" (section 3.8, waits for you),
  "Change password" (calls the existing `POST /api/auth/forgot-password` with the
  account email), sign out other devices (result as a toast), sign out.
- **Personal mobile (Livio, 2026-10-09; built; in Account since 2026-10-10, not Profile:
  it is DocCy's way to reach her and a future SMS sign-in factor).** Card under "Sign-in & security"
  (`components/dashboard/settings/PersonalMobileCard.tsx`): the /register country picker,
  its own Save (a real mobile for the country, `lib/professional-mobile.ts`, the same
  check the register server now makes), and a "Show on my profile" switch that saves at
  once (off by default; refused without a saved mobile). No founder: each change is a
  `request_log` row born `recorded` with the old value in `before_snapshot`
  (`professional_mobile_change`, `professional_mobile_visibility_change`).
  - `POST /api/professional-mobile` `{ mobile }` → 200 `{ changed, mobile }` · 400 not a
    valid mobile · 409 used by another professional. Same number: `changed: false`.
  - `POST /api/professional-mobile/visibility` `{ show }` → 200 `{ changed, show }` ·
    400 not true/false · 409 no saved mobile.
  - Both behind the emailed sign-in step (middleware), writing through the service role
    via `professional_mobile_set` / `professional_mobile_visibility_set`.
  - `/api/doctor-settings` no longer saves the mobile (an old page's `doctorPhone` is
    ignored). Where the mobile shows on the public profile is Ro008's decision on
    `feat/profile-redesign` (`docs/handoff/profile-redesign.md`); nothing shows it yet.
  - When SMS 2FA arrives, a new number will need verifying before it is saved.

### Buttons and loading states (frontend only; keep them when you add to Settings)
- One button system by role (primary, secondary, ghost/Cancel, danger, text link) in
  `components/dashboard/settings/styles.ts`; never restyle a button inline.
- Loading rules are written at the top of that file: the button that waits shows a
  spinner and "-ing…" (`BusyLabel`), is disabled and `aria-busy`; the block's fields are
  locked (`<fieldset disabled>` / `readOnly`); a dialog passed `busy` cannot be closed
  with Esc or the backdrop (its own buttons still close it after success); controls that
  save at once show "Saving…" (`SavingNote`); done is a toast with one id per block.

---

## 3. What the UI calls that does not exist yet

Each item: what the doctor does → what the page sends today → where it is called. The
outcome the UI assumes is noted so you know what the screen will show; how to achieve
it (tables, review flow, emails) is yours.

### 3.1 Remove a specialty
- UI: ✕ on a specialty chip (not offered on the last one).
- Sends `DELETE /api/doctor-specialties` with `{ "specialty": "<label>" }`.
- UI expects on success `{ "specialties": string[] }` (the approved labels left); on a
  refusal `{ "message" }`, shown as is.
- Call site: `handleRemoveSpecialty` in `components/dashboard/SettingsForm.tsx`.

### 3.2 Request a change to a clinic (name, address, phone, or move to a DocCy clinic)
- UI: "Request a change" on a clinic card.
- Sends `POST /api/clinic-change-requests` with
  `{ "locationId": "<professional_clinics.id>", "changes": ClinicChanges }` — only what
  changed (`ClinicChanges` in `lib/clinic-change-request.ts`; validation the UI already
  runs: `validateClinicChangeRequest`).
- UI expects 2xx, then shows "Change in review" on the card; `{ "message" }` on refusal.
- To keep that state after a reload, the page accepts
  `initial.pendingClinicChanges: Record<locationId, { changes, createdAt }>`
  (`app/settings/page.tsx` → `SettingsForm`). Nothing fills it today.
- Product intent (Rocío): DocCy reviews these. A clinic shared by several professionals
  should not be renamed by one of them; a rename is approved only for a clinic where the
  doctor is the sole professional.
- Call site: `components/dashboard/settings/ClinicChangeRequestDialog.tsx`.

### 3.3 Add a clinic
- UI: "+ Add clinic" → picker.
- Sends `POST /api/clinic-requests` with `{ "kind": "add", "clinic": NewClinic }`:
  `{ clinicId, name, location }` for an existing DocCy clinic, or
  `{ clinicId: null, name, phone, location }` for one DocCy does not have.
- UI expects 2xx, then shows a "Request in review" card. To keep it after a reload the
  page accepts `initial.pendingClinicAdds: { clinic, createdAt }[]`.
- Call site: `handleAddWorkplace` in `components/dashboard/SettingsForm.tsx`.

### 3.4 Leave (remove) a clinic
- UI: "Remove clinic" on a card (not offered on the last one). The dialog tells the
  doctor a clinic with upcoming or requested appointments can't be removed.
- Sends `DELETE /api/professional-clinics?locationId=<professional_clinics.id>`.
- UI expects 2xx (then removes the card, promoting the next clinic to primary on screen),
  or `{ "message" }` shown as is.
- Call site: `handleRemoveWorkplace` in `components/dashboard/SettingsForm.tsx`.

### 3.5 Cancel a pending specialty request
- UI: ✕ on the "In review" specialty chip.
- Sends `DELETE /api/specialty-requests` (no body: the UI assumes one pending request
  per professional).
- UI expects 2xx, then removes the chip; `{ "message" }` on refusal.
- Call site: `cancelSpecialtyRequest` in `components/dashboard/SettingsForm.tsx`.

### 3.6 Ask for a new specialty
- UI: "+ Add a specialty" → specialty + licence number.
- Sends `POST /api/specialty-requests` with
  `{ "requestKind": "add", "fromSpecialty": null, "toSpecialty", "toSpecialtyFromMaster", "licenseNumber" }`
  (`lib/settings-specialty-request.ts`).
- UI expects 2xx, then shows the "In review" chip; `{ "message" }` on refusal. To show a
  pending request after a reload the page accepts `initial.pendingSpecialtyChange`.
- Call site: `submitSpecialtyChangeRequest` in `components/dashboard/SettingsForm.tsx`.

### 3.7 Booking limits per clinic (needs a migration)
- Rocío, 2026-10-09: how far ahead, minimum notice and the online cancellation deadline
  belong to **each clinic**, with an "Apply to all my clinics" shortcut. All clinics are
  equal: there is no primary clinic in this decision.
- **Migration for you:** the three columns `booking_horizon_days`, `minimum_notice_hours`
  and `patient_cancel_notice_hours` have to move from `professional_settings` (one row
  per professional) to `professional_clinics` (one row per clinic). Copy each
  professional's current values to all their clinics, keep the same CHECKs and
  defaults, then drop them from `professional_settings` once nothing reads them
  (slot search, `/api/booking/choose`, manual booking, cancel window, reminders job:
  `grep -rn "booking_horizon_days\|minimum_notice_hours\|patient_cancel_notice_hours" app lib`).
- UI already sends them per clinic: each `locations[i]` of `POST /api/doctor-settings`
  carries `bookingHorizonDays`, `minimumNoticeHours`, `patientCancelNoticeHours`
  (`buildSettingsSavePayload` in `lib/settings-save-groups.ts`). The top-level fields
  are still sent too, as the clinic just changed, only because today's API reads them;
  drop them when you switch.
- To load them, fill `bookingLimits` on each location of the form data
  (`DoctorWorkplaceFormData.bookingLimits` in `app/settings/page.tsx`). As soon as one
  clinic has it, the form treats limits as per clinic.
- Until then (EXPECTED): a change on one clinic shows on all of them, and each card says
  "Expected for now: these limits apply to all your clinics until Livio stores them per
  clinic…" (`PER_CLINIC_LIMITS_PENDING` in `lib/settings-clinic-limits.ts`).

### 3.8 Change the sign-in email
- UI: Account → Sign-in & security → "Change email" → new address → "Send confirmation
  link" (Rocío, 2026-10-09).
- Sends `POST /api/account/email` with `{ "email" }` (already checked: well-formed and
  not the current one, `validateNewEmail` in `lib/settings-account.ts`).
- UI expects 2xx once a confirmation link has gone to the new address (Supabase's
  `auth.updateUser({ email })` does this), then shows "Waiting for you to confirm …";
  nothing changes until the link is opened. 409 = address already has an account,
  429 = too many tries, `{ "message" }` otherwise.
- Yours to decide: whether `professionals.registration_email` (and the booking emails) follows the new
  address on confirmation, and whether the page should load a pending change
  (the UI only keeps it until reload today).
- Call site: `requestEmailChange` in `components/dashboard/settings/AccountSecurityCard.tsx`.

3.1–3.6 and 3.8 currently get 404/405 and show, e.g.: "Expected to fail for now: removing a
clinic works once Livio builds it in the backend (DELETE /api/professional-clinics)."

---

## 4. Decisions that are yours

- **`professional_clinics.label`** is no longer shown anywhere. Keep, drop or repurpose
  it; nothing in the UI breaks either way. `lib/professional-clinic-settings-writes.ts`
  still writes it when a caller sends one.
- **Review flows** for clinic changes/additions and their emails (3.2, 3.3).
- **Founders' Club**: Harrison Ford (Testing) registered with `founders_club: false`, so
  approval set `subscription_tier = 'standard'`; Rocío set it to `founder` by hand on
  2026-10-01. Worth checking why that registration reserved no place.
- **Delete account / download my data** (Account): agreed as an idea, not built; needs a
  backend decision first.
- **New specialty requests** (3.5, 3.6): you dropped the old ones in E3; the UI waits
  for whatever you build under `/api/specialty-requests` (rename freely).
- **Notifications** is a separate task, not in this branch: draft UI and a proposed
  contract on `wip/settings-notifications` (pushed).

---

## 5. Data and environment notes

- Migrations (Livio, 2026-10-09; applied to Testing, not Production):
  - `20261009150000_professional_mobile_change_requests`: the two request types,
    `professional_settings.show_mobile_on_profile`, the two functions, `request_submit`
    snapshot steps, requester email from `registration_email`. Backward compatible, but
    this branch reads the new column: Production **before** merge.
  - `20261009160000_professionals_update_columns` (security): signed-in professionals
    could UPDATE every column of their own row through /rest/v1 (`pro_access_until`,
    `subscription_tier`, `is_registered`, `slug`, the mobile…). Now only `bio`,
    `languages`, `is_gesy` and the two sign-out columns. master still saves the mobile
    through the session, so Production **after** merge.
  - DB tests: `supabase/tests/professional_mobile_change.test.sql`,
    `supabase/tests/professionals_update_columns.test.sql`.
- New writes: the mobile and its switch (section 2, Account). Otherwise none.
- New reads: `professional_clinics.id` (clinic phones on cards,
  `lib/settings-clinic-phones.ts`); `professionals.pro_access_until` (Plan & billing).
- Changed read: clinic names come from `clinics.name` (section 2, Clinics).
- Testing data changed on 2026-10-01: removed the test clinic "Harrison Ford" (link
  "dermakk") and two test specialty requests; set Harrison Ford's tier to `founder`.

---

## 6. Merged with master (2026-10-09, incl. `feat/doctor-dashboard` #270 and #272)

- #272 (appointments M2 drops legacy `appointments` columns): merged cleanly; nothing in
  this branch reads or writes those columns.
- `lib/doctor-routes.ts`: the Settings tab, active tab and login gate now use `/settings`.
- `app/settings/page.tsx` was rebuilt on master's data loading (no `status`,
  `professional_services`, account settings select, `accessEnded`).
- Notes below are kept for history.

### Before the merge

- That branch still has `app/agenda/settings/page.tsx` and nav links to
  `/agenda/settings`; here settings moved to `app/settings/page.tsx`. Point links at
  `/settings` (`lib/settings-sections.ts` → `settingsSectionHref`).
- Agenda header: both branches removed the Founding Member badge.
- Insights still renders the badge; it now links to Plan & billing.
- Pro page layout: `components/navigation/ResponsiveBottomInset.tsx` makes a pro page one
  window tall under the header (no extra scroll). Check the agenda's own "fits the
  window" layout when merging.

---

## 7. Tests

- Unit (all in `npm run test:unit`): `settings-sections`, `settings-removal-rules`,
  `clinic-change-request`, `settings-clinic-summary`, `settings-specialty-request`,
  `settings-backend-pending`, `settings-account`, `settings-save-groups`,
  `settings-plan`, `booking-sign`, `settings-clinic-limits`, `settings-form-dirty`.
- e2e: `tests/integration/settings_redesign.integration.spec.ts` (@pr-e2e). Tests for
  3.1, 3.2, 3.3 and 3.5 stub the endpoints with `page.route` and pin the request body;
  replace the stubs with the real endpoints when they exist.
- Updated specs for the new layout: promote, language guard, dashboard, feedback matrix,
  public phones, sign-out other sessions, registration review, avatar, and others.
- e2e also covers: limits per clinic (and that each save already sends every clinic's
  limits), Change email (expected failure, then a stubbed success), Preview profile
  ("Opening…" + toast) and a slow save (spinner, fields locked).
- Last full local run (like CI), 2026-10-09 on `cd87015`: 293 passed in the CI lanes,
  7 outside CI.
