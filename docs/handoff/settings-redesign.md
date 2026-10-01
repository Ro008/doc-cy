# Settings redesign — handoff to backend (START HERE)

Branch: `feat/settings-redesign` · Frontend: **final** (Rocío, 2026-10-01) · Backend and
database: **Livio decides**.

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

---

## 2. What the frontend now does

### Page and navigation
- Settings lives at **`/settings`** (`app/settings/page.tsx`), not under the agenda.
  `/agenda/settings` redirects there keeping `?section=`. Same middleware gate as
  `/agenda` (`isProfessionalGatedPath`).
- A sidebar of sections, kept in `?section=` (default `availability`):
  Availability · Clinics · Services & prices · Profile · Contact & phone · Promote ·
  Plan & billing · Account (`lib/settings-sections.ts`).
- Old `/settings?section=account#promote-practice` links land on Promote.

### One save rule (frontend only; same API)
- No page-wide "Save settings". Booking limits, languages and turning holiday mode off
  save at once; a clinic's hours, the bio, the mobile and holiday dates have their own
  Save / Cancel (`lib/settings-save-groups.ts`).
- Still `POST /api/doctor-settings`, unchanged. That API replaces everything it is sent,
  so each save sends **the last saved settings with only that block changed**. Expect
  more, smaller saves than before. If you ever make that API accept partial updates,
  `buildSettingsSavePayload` is the one place to adapt.

### Clinics
- One card per clinic: status, online booking switch (`POST /api/doctor-online-bookings`,
  unchanged), summary of days/hours/break/slot, "Edit hours" editor in the card.
- A clinic's **name, address and phone change only by request** ("Request a change").
  Only hours are editable.
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

### Availability
- Booking limits and holiday mode as before (data unchanged).
- Holiday mode sits in the sidebar on wide screens and inside Availability on phones.
- "Online booking by clinic" is a status summary; the switches live on the clinic cards.

### Profile
- Specialties: removing one is instant (✕ on the chip) while one is left. Asking for a
  new one only sends `requestKind: "add"` to `POST /api/doctor-specialty-change-request`
  (unchanged API): a change is "add the new one, remove the old one once approved", so
  "replace"/"remove" requests are no longer sent (older pending ones still display).
- The pending request shows as an "In review" chip with ✕ to cancel it (section 3.5).
- "Preview profile" link in Profile and Services.

### Contact & phone
- Mobile (private) with its own Save. Clinic phones are read-only and point to
  Clinics → Request a change.

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

### Account (frontend only)
- "Sign-in & security": signed-in email, "Change password" (calls the existing
  `POST /api/auth/forgot-password` with the account email), sign out other devices,
  sign out.

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
- Sends `DELETE /api/doctor-specialty-change-request` (no body: one pending request per
  professional today).
- UI expects 2xx, then removes the chip; `{ "message" }` on refusal.
- Call site: `cancelSpecialtyRequest` in `components/dashboard/SettingsForm.tsx`.

All five currently get 404/405 and show, e.g.: "Expected to fail for now: removing a
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
- **Notifications** is a separate task, not in this branch: draft UI and a proposed
  contract on `wip/settings-notifications` (pushed).

---

## 5. Data and environment notes

- Migrations: none. New writes: none.
- New reads: `professional_clinics.id` (clinic phones on cards,
  `lib/settings-clinic-phones.ts`); `professionals.pro_access_until` (Plan & billing).
- Changed read: clinic names come from `clinics.name` (section 2, Clinics).
- Testing data changed on 2026-10-01: removed the test clinic "Harrison Ford" (link
  "dermakk") and two test specialty requests; set Harrison Ford's tier to `founder`.

---

## 6. Merging with `feat/doctor-dashboard`

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
  `settings-plan`, `booking-sign`.
- e2e: `tests/integration/settings_redesign.integration.spec.ts` (@pr-e2e). Tests for
  3.1, 3.2, 3.3 and 3.5 stub the endpoints with `page.route` and pin the request body;
  replace the stubs with the real endpoints when they exist.
- Updated specs for the new layout: promote, language guard, dashboard, feedback matrix,
  public phones, sign-out other sessions, registration review, avatar, and others.
- Last full local run (like CI): 207 passed in the CI lanes, 7 outside CI.
