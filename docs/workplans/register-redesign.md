# Workplan — /register redesign (branch `feat/register-redesign`)

Working notes to continue this work in a new chat. Branch is **not pushed**; no PR yet.
Rebased on `master` at `c889470` (PR #207, locations D3a).

Conventions for this work: TDD (tests first, see CLAUDE.md); frontend/UI only unless
agreed (no DB schema changes); every commit states **DB impact**; replies to Rocío in Spanish;
commands she runs in PowerShell; ask before creating branches.

## Done (committed, in order)

| Commit | What |
|---|---|
| `476a060` | Finder "Are you a healthcare professional?" and blog "claim your profile" → `/register` |
| `147c664` | Stop claiming automatic calendar sync (for-professionals EN/EL, register copy). Reality: confirmation emails carry "Add to Google Calendar" / "Apple / Outlook (.ics)" |
| `2977dd8` | Redesign: split layout (wizard left, sticky teal benefits panel right), accordion wizard with step summaries, price ticket with live Founders count, "What happens next", FAQ (7), setup-call card |
| `cf99bc8` | Everything fits one desktop viewport (1440×900 and 1280×800 for step 1) |
| `68d4fbe` | Step 1: Gender (Male/Female) and "Work with GeSY?" (Yes/No), required, compact segmented control. **UI only — not stored** |
| `36d3011` | Step 1 validation: mobile with country-code dropdown + per-country mobile check (`libphonenumber-js/mobile`, posts E.164); fixed email `pattern` (was ignored under the `v` flag); "Did you mean…?" email typos; names need a letter, no digits; live password checklist; fixed a hydration mismatch (country names rendered client-only) |
| `96ca40e` | Step 2: languages as one-click pills (brand teal); photo checks before crop (HEIC message, min 400×400); new upload/crop UI (drop zone, light dialog, Escape, focus trap); drag & drop; 600×600 test fixture |
| `2f2a28e` | Step 3: specialty and licence aligned (visible "Specialty*" label, same input box) |
| `510a456` | Claim prefill: gender (`professionals.gender`) and GeSY "Yes" when `is_gesy` (false = unknown → left blank). Step 2 has nothing to prefill (listings have no languages/photo) |

## Clinic search + multiple clinics (committed: "feat(register): search DocCy clinics and add several clinics")

Agreed with Rocío:
- Search **DocCy's clinics first**, server-side over all active clinics (name + address + town,
  accent/case-insensitive, min 2 chars, top 8, name-prefix first then most professionals).
  Google Maps stays as the fallback ("Search Google Maps"), pin still available there.
- **Phase 1 now (frontend only):** picking a DocCy clinic fills address/pin/district/town from
  that clinic and posts a hidden `clinicId` (`clinicId`, `clinic1Id`, …). The server **ignores it
  for now** — it still creates a new clinic, as today.
- **Phase 2 later (backend, with Livio):** link to the existing clinic by `clinicId` instead of
  creating a duplicate. Today the D1 mirror (`doctor_locations` → `professional_clinics`) only
  reuses an existing clinic for claims; for new sign-ups it inserts a new `clinics` row.
- **Every professional can add up to 5 clinics** (server already reads `clinicAddress`,
  `clinic1Address`… contiguously, stops at the first gap). Claim prefills all listing clinics.
- With 2+ clinics: rows in an **accordion**, one open at a time; folded rows show
  "Clinic N · name/address · ✓". Missing-field list opens the folded row (reveal event).

Files:
- `lib/register-clinic-search.ts` (+ `tests/unit/register-clinic-search.test.ts`, passing)
- `app/api/register/clinic-search/route.ts` — read-only, public fields only, `clinicSearch`
  rate-limit bucket (150/h) added in `lib/public-api-rate-limit.ts`
- `components/auth/RegisterClinicSearchInput.tsx` — type-ahead (finder town combobox pattern)
- `components/auth/RegisterClinicAddressField.tsx` — `docCySearch` + `onClinicChange` props,
  "From DocCy" badge + clinic name in "Patients will see", hidden `clinicId`
- `components/auth/RegisterClinicsFields.tsx` — accordion rows, add/remove, max 5
- `components/auth/useRegisterFieldStates.ts` — `REGISTER_REVEAL_EVENT` before focusing
- `lib/register-clinic-location.ts` — `clinicId` input names
- `app/register/page.tsx` — uses `RegisterClinicsFields`; step 3 copy updated
- `tests/integration/register_clinics.integration.spec.ts` (run with the integration env, see below)
- `tests/integration/register_clinic_location.integration.spec.ts` covers the Google / pin path
  through `switchRegisterClinicToGoogle(page)` (DocCy search is the default)
- "Add another specialty" and "Add another clinic" share `registerAddAnotherButtonClass`
  (compact link-button) so step 3 still fits 1440×900

### Clinic rows: rules agreed with Rocío (commit "feat(register): lock DocCy clinics, name other clinics, add clinics in order")
- A picked **DocCy clinic is read-only**: no "Adjust pin" / "Add map pin", only "Change clinic".
  Exception: a DocCy clinic without coordinates still asks for a pin (registration needs one).
- **Clinic name is required** for Google / pin clinics ("Clinic name*"; prefilled from a Google
  business name, or the claimed listing). Posted as `clinicName`, `clinic1Name`… — the server
  **ignores it for now** (phase 2 with Livio; today the DB trigger names new clinics after the
  professional). `doctor_locations.label` exists but is not used.
- A clinic is **done** only with location + name and while not being searched again
  ("Change clinic" makes it unfinished until they pick or Cancel).
- **One at a time:** "Add another clinic" is disabled until every row is done
  ("Finish clinic N to add another.").
- **No clinic twice:** the DocCy search hides clinics picked in other rows (by id only — two
  DocCy clinics can share a building address). A row with the same address as an earlier one says
  "Same address as clinic N" and is not done, because the server keeps one clinic per address
  today (phase 2 could allow different `clinicId`s at one address).
- Row headers **toggle** (the open row folds; all rows may be closed).

### Still to check
- Mobile layout of the accordion rows and the search dropdown.

## Step 3 analysis items — done (commit "feat(register): polish step 3 fields")
1. Google Maps loads with `language=en&region=CY` (`googleMapsScriptUrl`), shared by register,
   Settings and the pin map: saved addresses read "Nicosia, Cyprus".
2. "Other (Specify)" reads as chosen; "Describe your specialty" matches the register inputs, spans
   the row, needs ≥3 letters (`isValidRegisterCustomSpecialty`).
3. One specialty: only its "Specialty*" label; the "Specialties*" title appears from the second row.
4. "Add another specialty" shares the compact style with "Add another clinic".
5. Licence: ≥3 characters and a digit (`isValidRegisterLicenseNumber`, client only; the server
   still only requires non-empty).
6. Disclaimer checkbox restyled (brand accent, checked/invalid box states), legal text unchanged.
7. Map preview before "Looks right" is 128px on register (Settings keeps 160px).

## Open decisions for Rocío
- Two specialty aliases that look wrong in `harmonizeFinderSpecialtyLabel`:
  "Laser & Medical Aesthetics" → Plastic Surgery, "Wellness" → Personal Doctor (affects finder too).
- Gender/GeSY are collected but not stored (needs backend when wanted).
- Phase 2 of clinic linking (with Livio).

## How to run the checks
```
npm run -s test:unit
npx playwright test tests/integration/register_form_guidance.integration.spec.ts tests/integration/register_clinic_location.integration.spec.ts tests/feedback_support_modal.spec.ts tests/navigation.spec.ts tests/landing.spec.ts --project="Desktop Large (Chromium)" --workers=2 --retries=0
npx playwright test tests/integration/register_form_guidance.integration.spec.ts --project="Mobile Chrome (Pixel 5)" --workers=2 --retries=0
```
Specs that read the testing DB (claim prefill, clinics) need the integration env (bash):
```
PLAYWRIGHT_ENV_FILE=.env.testing.local PLAYWRIGHT_BASE_URL=http://localhost:3000 INTEGRATION_SAFE_ENV=1 PROD_NEXT_PUBLIC_SUPABASE_URL=https://oiwlztcduxojadbcxkil.supabase.co npx playwright test tests/integration/register_claim_prefill.integration.spec.ts tests/integration/register_clinics.integration.spec.ts --project="Desktop Large (Chromium)" --retries=0
```
Dev server: `doccy-dev` in `.claude/launch.json` (port 3000, testing DB). Tests type only after
the wizard hydrates (`waitForRegisterWizardReady`). Not run: `npm run test:e2e:register`
(live sign-up + Resend).
