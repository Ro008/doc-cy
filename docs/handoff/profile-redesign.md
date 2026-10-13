# Public profile redesign — backend handoff

Branch `feat/profile-redesign`. The frontend is done; this note says what the public
profile now does and the one thing it waits for from the API and the database.
Reference design: https://claude.ai/artifact/XuWafV4bu6Acv8GRdcsXBH (page "Ronda 3").

## Before / right after merging this branch

- [x] **Done 2026-10-13.** Vercel → doc-cy → Settings → Environment Variables, **Production only**:
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Config) and `TURNSTILE_SECRET_KEY` (Secret), from Cloudflare →
  Turnstile → "DocCy public forms". No redeploy needed now: production runs master, which has no
  Turnstile code; the first production build after this branch merges picks both up. Previews keep
  it off. Until both are set, the booking route logs `[DocCy] Turnstile is OFF in production`.

## What changed in the UI

- **One page.** Hero, then sticky tabs **Book · About · Services & prices · Clinics &
  contact**. The tabs are anchors (`#book`, `#about`, `#services`, `#clinics`); nothing
  navigates away. Tabs of empty sections are hidden (`lib/public/profile-sections.ts`).
- **Hero.** Photo, name, GESY badge, specialties, the doctor's optional headline, the
  district (link to the finder) and the clinics (link to `#clinics`), both underlined as
  links, and the languages as the finder's colour chips. No language switcher on the
  profile until the Greek copy is reviewed (the `/el/...` URLs still work).
- **Footer**: "About DocCy" → `/for-professionals`.
- **Industry basics** (2026-10-02): breadcrumbs (primary specialty › district ›
  name, `lib/public/profile-breadcrumbs.ts`); each clinic's opening hours from its schedule
  (`lib/public/clinic-opening-hours.ts`); on phones a "Request appointment" bar once the
  hero scrolls away; "Share" (system sheet or copy link); "Report incorrect information"
  opening the feedback form with the profile named; JSON-LD = Physician (services,
  languages, every clinic as MedicalClinic with geo + opening hours, no phones) +
  BreadcrumbList (`lib/public/profile-structured-data.ts`).
- **Canonical fix**: registered profiles inherited the root layout's canonical "/", i.e.
  told search engines they were the home page. They now point at `/en/{slug}`.
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
  `doccy_scheme` (`lib/profile-scheme.ts`, one year, all profiles) read by the
  server, so there is no flash. Nothing to store in the database. Colours live in
  `lib/profile-theme.ts` and reach the page as CSS variables (`.doccy-profile` +
  `data-scheme` in `app/globals.css`, Tailwind `profile-*` / `accent-*`).
- **Motion**: one pulsing dot when today still has free times, a one-time entrance of the
  day cards and time chips, a small "pop" on the chosen time. All off with
  `prefers-reduced-motion`.

## Headline, personal mobile and colours (Livio, 2026-10-13)

Nothing waits for the backend any more.

- **No colour choice, no light/dark in Settings** (Livio and Rocío): every profile is DocCy
  teal (`PROFILE_ACCENT` in `lib/profile-theme.ts`). Light/dark is the visitor's choice, meant
  for the whole public site later (cookie `doccy_scheme`, was `doccy_profile_scheme`). The top
  bar's logo follows the mode (white "my" on the dark bar, `FinderPublicHeader`).
- **Headline**: Settings › Profile › "Headline", right below "Name and photo"
  (`components/dashboard/ProfileHeadlineCard.tsx`), optional, ≤ 90 characters.
  `PATCH /api/professional-profile-customization` body `{ "headline": "…" | null }` →
  `professional_headline_set` (migration `20261013150000_professional_headline_change`):
  column `professionals.profile_headline`, every change recorded in `request_log`
  (`professional_headline_change`, status `recorded`, no founder), **at most 5 changes in a
  rolling 30 days** (429 with the date it opens again, shown as a toast). The pages read it
  with `loadProfileHeadline` (`lib/profile-headline-server.ts`), which returns no headline
  when the column is missing, so the code is safe before Production has the migration.
- **Personal mobile**: when she turned "Show on my profile" on (Settings › Account), the hero
  shows **"Show mobile"** next to the district and Clinics & contact shows **"Show personal
  mobile"** under its heading (`RevealMobileButton`). The number is fetched on the click from
  `POST /api/directory/professional-mobile-reveal` (same rate limit as the clinic phones; one
  404 for hidden, missing or unknown). Never in the page's HTML, never in the JSON-LD.
  Not recorded in `user_events` yet.
- **Hero**: the clinic count ("2 clinics" / "Clinic details") is gone; the clinic picker and
  the "Clinics & contact" tab already say it. The districts stay.

## Booking form and security (earlier work)

3. **Booking form: gender and date of birth.** Done on master (2026-10-04, Livio):
   `patientGender` / `patientBirthdate` → `appointments.patient_gender` /
   `patient_birthdate`. The profile form uses master's validation
   (`lib/booking-form-validation.ts`) in the profile's colours; the earlier stub
   (`lib/booking-patient-details.ts`) is gone.

4. **Booking form: which service** (user, 2026-10-09). When the professional lists
   services, the form asks "What is the visit for?" (a dropdown of her services by name,
   no prices, plus Other). The free-text reason box is always there: optional with a service
   ("Anything … should know? (optional)"), required with Other or when there are no services
   (user, 2026-10-09, as Zocdoc/Doctolib: a visit type plus optional notes). `POST /api/appointments` gets `professionalServiceId` →
   `appointments.professional_service_id` (+ `service_name`, copied by the database);
   already built on master (`lib/requested-service.ts`). Because the database requires a
   reason on every booking (`appointments_booking_fields_check`), a chosen service is also
   sent as `reason` only when the patient leaves the optional text empty (its name) — see `lib/booking-service-choice.ts`. If that duplication
   bothers anyone, relax the check when a service is set.
   **Shown** (user, 2026-10-09) via `lib/visit-purpose.ts` (service first; the reason only
   when it says more than the service name): dashboard request card and today's schedule,
   agenda visit details, review page, the patient's confirm-link and confirmation emails, the
   professional's new-request email, and both calendar invites (.ics, Google links, reminder).
   The reads add `service_name` to `DASHBOARD_APPOINTMENT_SELECT`, `AGENDA_APPOINTMENT_SELECT`
   and the selects of the confirm, choose, calendar, success-page and reminder paths; no writes
   changed. Not shown: decline and reschedule-proposal emails (they show no reason either).

5. **Booking form: patient boxes** (user, 2026-10-10). First name + last name (both
   required, nothing else checked; sent joined as `patientName`), birth date as Day / Month /
   Year (sent as `patientBirthdate` YYYY-MM-DD as before), mobile phone with the dial code
   fixed next to the flag and an example number. **Server change, agreed with Livio (no DB):**
   `POST /api/appointments` now refuses a phone that isn't a real mobile for its country
   (`onlineBookingPhoneProblem` in `lib/phone-number.ts`, the same libphonenumber rule as
   manual booking; a number without a country code is read as Cypriot). Stored as sent.

7. **UX pass over the profile and its booking form (user, 2026-10-11)**, all frontend:
   "What to expect" now has the email step (4 steps); every missing field is marked at once
   (`allBookingFormErrors`); the calendar opens on the first day with times (a picked day can't be
   un-picked); the button after picking a time is "Continue" (was "Confirm"); steps read 1/2/3 of 3
   with several clinics; the clinic picker hides while "Your details" is filled in (shared
   context `ProfileBookingStep`, set in a layout effect so the scroll to the form lands right);
   each service has a "Book" button that preselects it in the form (`doccy:profile-select-service`);
   the "Add to Home Screen" banner is hidden on the profile (`HideInstallBanner`, an attribute on
   `<html>`). E2E helpers: `tests/helpers/bookingCalendar.ts` (the calendar replaces the old
   "Select a date on the calendar" placeholder as the sign the booking box is there; `Continue`
   also matches the older "Confirm").

6. **Security review (user, 2026-10-11).**
   - Profile JSON-LD now goes through `stringifyJsonLd` (`lib/json-ld.ts`, escapes `<`): a
     professional's own text could close the `<script>` and run code (was on master too).
   - `.ics` text escapes every line break (`lib/ics-text.ts`), so a patient's words can't add
     properties to the professional's calendar event.
   - **Cloudflare Turnstile** on the online booking form (`lib/turnstile.ts`,
     `components/booking/TurnstileWidget.tsx`): `POST /api/appointments` refuses
     (`400 bot_check_failed`) unless Cloudflare confirms a person sent the form, before any
     draft or email. Widget "DocCy public forms" (Managed, `interaction-only`: normally
     invisible). Active only when **both** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and
     `TURNSTILE_SECRET_KEY` are set — put them in Vercel → Production only (local, CI and
     previews stay off). No DB change.

## Data notes

- One migration in this branch: `20261013150000_professional_headline_change` (a new column, request type and function; backward-compatible). Other reads are unchanged (`professionals`, `professional_services`,
  clinic locations, the occupied-slots RPC).

## Tests

- Unit: `tests/unit/profile-*.test.ts` (palette contrast WCAG AA in light and dark, headline,
  next availability, sections, clinic cards, customization contract, layout).
- E2E: `tests/profile_one_page.spec.ts` (`@pr-e2e`: anchors, opens in light + Light/Dark
  switch remembered on reload, reduced motion, day card opens the day) and `tests/doctor_profile_mobile.spec.ts`.

## Settings (after #279): done

"Your public page" now sits in **Settings › Profile**, as its last card (a set-once look comes
after what patients rely on), in the shared settings look (card, eyebrow, buttons, toast, busy
state). The `#public-page` anchor works (`/settings?section=profile#public-page`). Save and
Cancel appear when something changed; the save still goes to
`PATCH /api/professional-profile-customization` (see "What waits for the backend").

## Reviews, notes and the share card (2026-10-13)

No database change: everything **reads** `professional_reviews` (written by
`POST /api/booking/review`, service role only) and never selects `reviewer_email`.

- **Profile**: a "Patient reviews" section (and tab) at the bottom, after Clinics & contact (Livio, 2026-10-13), only when
  there are published reviews. Names are "Maria K.". The average is cut, not rounded, to one
  decimal (24 fives and a four read 4.9). `status = 'hidden'` rows never show.
- **The bar is 3 reviews** (`PROFILE_HERO_RATING_MIN_REVIEWS`): the hero line, the finder card
  note and the shared preview only show the average from 3 reviews. The section itself shows from 1.
- **Finder card**: "★ 4.6 (12)" on registered cards, from one read for the cards on screen
  (`loadPublishedRatings`, id chunks). Order of results is untouched.
- **Shared link preview**: the description leads with the note (3+ reviews); the description
  Google reads is unchanged.
- **Share card image**: `GET /api/og/profile/[slug]?v=…` draws 1200×630 (photo, name,
  specialties, district, note) with Inter (`assets/fonts/inter`, OFL). The `v` in
  the link is a hash of everything drawn (`profileShareCardVersion`); the route only draws when
  `v` is current (else a 307 to the current one, a 404 for an unknown slug) and the result is
  cached for a year, so a crawler cannot make the server draw by inventing versions.
  Changing the card's *design* does not change `v`: add a design number to the hash if you retouch it.
- **Manual booking**: an optional "Service" choice (never required; a picked service makes the
  reason optional, the service name stands in). Uses `professionalServiceId`, already accepted
  by `POST /api/appointments/manual`.
- **Settings › Services**: the "What are services?" block has four points with icons; the
  "N of 20 services" counter only shows from 15 services on. `tests/integration/settings_redesign.integration.spec.ts`
  no longer expects "1 of 20" (it expects no counter): please watch it in CI.

## To check on the PR preview

- The share card route in Vercel's production build (`sharp` and the fonts read from disk;
  `outputFileTracingIncludes` is set in `next.config.mjs`).
- `/api/og/profile/<slug>` for a professional with a photo, and one without.
