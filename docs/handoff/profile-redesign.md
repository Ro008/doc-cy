# Public profile redesign — backend handoff

Branch `feat/profile-redesign`. The frontend is done; this note says what the public
profile now does and the one thing it waits for from the API and the database.
Reference design: https://claude.ai/artifact/XuWafV4bu6Acv8GRdcsXBH (page "Ronda 3").

## What changed in the UI

- **One page.** Hero, then sticky tabs **Book · About · Services & prices · Clinics &
  contact**. The tabs are anchors (`#book`, `#about`, `#services`, `#clinics`); nothing
  navigates away. Tabs of empty sections are hidden (`lib/public/profile-sections.ts`).
- **Hero.** Photo, name, GESY badge, specialties, the doctor's optional headline, the
  district (link to the finder) and the clinics (link to `#clinics`), both underlined as
  links, and the languages as the finder's colour chips. No language switcher on the
  profile until the Greek copy is reviewed (the `/el/...` URLs still work).
- **Footer**: "About DocCy" → `/for-professionals`.
- **Districts**: the hero names every district where the professional has a clinic
  ("Nicosia · Paphos"), each a link, not only the primary one (`lib/public/profile-districts.ts`).
- **Prices**: a bare number gets the euro sign after it ("100" → "100 €"); prices the
  doctor wrote with a currency or words stay as written (`lib/public/service-price.ts`).
- **Booking form**: Confirm scrolls to the top of "Your details"; the email gets the same
  checks as /register (valid format, "Did you mean …?" for typos like `gmai.com`).
- **Fades**: a soft fade at the bottom of the screen while the page continues below (as on
  the doctor dashboard), and on the tabs' edge when they scroll sideways on phones.
- **Next availability** in the hero: up to six days with their first free time ("Today
  from 14:00", "Mon 5 Oct from 11:00"). It uses the same slot rules as the calendar
  (`computePublicAvailabilityCalendar`), for the clinic being booked. Tapping a day opens
  that day in the calendar without reloading (`lib/public/profile-day-select.ts`).
- **Booking.** Same flow and same API (`POST /api/appointments`): clinic picker, calendar,
  time chips, Confirm, your details. Only the look changed.
- **About** is open (no accordion). **Clinics & contact** merges the old Contact and
  Location cards: one card per clinic with its address, "Open in Maps" and the clinic's
  phone (`RevealPhoneButton`, unchanged) (`lib/public/profile-clinic-cards.ts`).
- **Light and dark.** Every profile opens in light. A Light/Dark switch next to the
  language switcher lets anyone change it; the choice is a first-party cookie
  `doccy_profile_scheme` (`lib/profile-scheme.ts`, one year, all profiles) read by the
  server, so there is no flash. Nothing to store in the database. Colours live in
  `lib/profile-theme.ts` and reach the page as CSS variables (`.doccy-profile` +
  `data-scheme` in `app/globals.css`, Tailwind `profile-*` / `accent-*`).
- **Motion**: one pulsing dot when today still has free times, a one-time entrance of the
  day cards and time chips, a small "pop" on the chosen time. All off with
  `prefers-reduced-motion`.

## What waits for the backend

Professionals can personalise their page: **one of three colours** (teal, amber,
violet) and an **optional headline** (≤ 90 characters). Settings › "Your public page"
(`components/dashboard/ProfilePageCustomization.tsx`) edits both with a light/dark preview.
The contract is in `lib/profile-customization.ts`:

1. **Read.** Columns `professionals.profile_accent text` (one of `teal`, `amber`,
   `violet`; default `teal`) and `professionals.profile_headline text`
   (nullable, ≤ 90 chars). Add them to the public profile field list
   (`DOCTOR_FIELD_LIST_PUBLIC_PROFILE*` in `lib/doctor-fieldsets.ts`) and to the settings
   page select. The page already calls `profileCustomizationFromRow(profile)`, which reads
   them when present and falls back to teal / no headline.
2. **Write.** `PATCH /api/professional-profile-customization`, signed-in professional,
   body `{ "accent": "amber", "headline": "Kind, careful skin care" | null }`.
   Validate with `resolveProfileAccent` and `profileHeadlineError`, write the two columns
   of the caller's own row, answer `200 { ok: true }`; `400` on invalid input, `401` when
   signed out. Today the call returns 404 and the screen shows
   "Expected to fail for now: … (PATCH /api/professional-profile-customization)".

## Data notes

- No migrations in this branch. Reads are unchanged (`professionals`, `professional_services`,
  clinic locations, the occupied-slots RPC).
- Unknown or missing accent values always render as teal, so a bad row never breaks a page.

## Tests

- Unit: `tests/unit/profile-*.test.ts` (palette contrast WCAG AA in light and dark, headline,
  next availability, sections, clinic cards, customization contract, layout).
- E2E: `tests/profile_one_page.spec.ts` (`@pr-e2e`: anchors, opens in light + Light/Dark
  switch remembered on reload, reduced motion, day card opens the day) and `tests/doctor_profile_mobile.spec.ts`.

## When `feat/settings-redesign` is merged

That branch (not in master yet, 2026-10-02) moves settings from `/agenda/settings` to
`/settings`, a sidebar of sections, and redirects the old URL. This branch added a
**"Your public page"** block (`components/dashboard/ProfilePageCustomization.tsx`) to the
current `/agenda/settings` page. Whoever takes over `feat/settings-redesign` (most likely
Livio) should, when merging the two:

- Move "Your public page" into the **Profile** section of the new sidebar (it is about how
  the profile looks: colour + headline, next to photo and bio). It keeps its own Save,
  which fits that branch's "one save rule" (a block saves on its own).
- Keep the `#public-page` anchor working, or update the owner banner link on the public
  profile (`/agenda/settings#public-page` in `lib/public/doctor-profile-page.tsx`) to the
  new URL, e.g. `/settings?section=profile#public-page`.
- Restyle it with the new settings look if it differs; the live preview must keep the
  `doccy-profile` class, `data-scheme` and `profileThemeStyle(...)` so it shows the real
  page colours in light and dark.
- The save still goes to `PATCH /api/professional-profile-customization` (see above).

A comment at the call site in `app/agenda/settings/page.tsx` repeats this, so it shows up
in the merge conflict.
