# Critical flow test coverage (inventory)

Living document: update when workflows or specs change.

- **PR lane:** `.github/workflows/pr-integration.yml` → `PR Playwright (core business)`
- **Nightly lane:** `.github/workflows/prod-critical-smoke.yml` → `prod-critical-smoke` (production URL only; no integration E2E job)

## Legend

| Status | Meaning |
| --- | --- |
| **Stable (PR)** | Run on every PR merge gate |
| **Stable (nightly)** | Blocking in `Production Monitoring` (prod URL) |
| **Nightly monitor** | Same workflow, non-blocking step |
| **Local / optional** | Exists in repo; not in PR gate |
| **Gap** | No automated coverage identified |

---

## Public surfaces

| Flow | PR blocking | Other | Notes |
| --- | --- | --- | --- |
| Landing / marketing shell | Partial via `navigation.spec.ts` | `landing.spec.ts`, `prod_site_availability.spec.ts` (preview) | PR navigation suite scope depends on test content |
| Finder search & filters | `finder_critical.integration.spec.ts`, `finder_user_behaviors.integration.spec.ts` | — | PR only (not nightly) |
| Doctor public profile | `profile_structured_data.spec.ts`, `booking_flow.spec.ts` | `doctor_profile_mobile.spec.ts`, `service_menu_public_profile.integration.spec.ts` | Mobile layout local/supabase |
| Blog content / MDX | `blog_single_image_ui.spec.ts` | `blog_scheduling.spec.ts`, `blog_user_flow.spec.ts` | PR runs `npm run test:content:blog-images` |
| Language / locale | Partial | `language_switcher.spec.ts`, `landing_i18n.spec.ts` | Not all in PR gate |

## Authenticated doctor

| Flow | PR blocking | Other | Notes |
| --- | --- | --- | --- |
| Agenda / dashboard core | Via integration suites touching agenda | `doctor_dashboard.spec.ts`, `prod_*` smoke | Not every doctor UI path in PR |
| Settings (clinic address notice) | `settings_clinic_address_notice.integration.spec.ts` | `prod_settings_profile_smoke.spec.ts` | |
| Schedule constraints | `schedule_constraints.spec.ts` | — | Uses configured slug |
| Multi-session / visit reason | `agenda_multisession_sync`, `agenda_visit_reason` (email guards step) | — | Desktop |
| UserBar (desktop dropdown + mobile tabs) | Partial | `practice_insights.spec.ts`, `navigation_feedback.spec.ts` | Mobile tabs, no FAB, Settings loading affordance |
| Practice insights page | `practice_insights.spec.ts` | — | English-only; mobile tab navigation to Insights |
| Marketing footer + auth footer routing | **Gap** | Removed (flake) | Was `tests/footer_navigation.spec.ts` |

## Booking / appointments

| Flow | PR blocking | Other | Notes |
| --- | --- | --- | --- |
| Patient booking (happy path) | `booking_flow.spec.ts` | `prod_appointment_booking_flow.spec.ts` (nightly blocking) | Requires first-visit choice (`is_new_patient`) |
| Practice insights — new patients / no-shows KPIs | `practice_insights_metrics.spec.ts` | `practice_insights.spec.ts` | `is_new_patient`, `attendance=no_show` on ended visits |
| Manual booking (doctor) | `manual_booking_flow.spec.ts`, `manual_booking_modal_ux.spec.ts` | — | Empty email/phone case + WhatsApp only when phone set; see **Optional UI fields** in `ci-test-policy.md` |
| Race / concurrency | `appointments_race_condition.integration.spec.ts` | — | |
| Reschedule slot free | `needs_reschedule_slot_free.integration.spec.ts` | — | |
| Doctor proposes reschedule (CONFIRMED → NEEDS_RESCHEDULE) | `propose_reschedule_confirmed.integration.spec.ts` | — | API: alternative-slots + propose-reschedule |
| Reschedule email content | `reschedule_email_content.integration.spec.ts` | — | |
| Trial period logic | — | — | **Gap** (spec removed; was referenced in workflows) |

## Auth / security

| Flow | PR blocking | Other | Notes |
| --- | --- | --- | --- |
| Sign-out / sessions | — | `auth_signout_other_sessions`, `auth_session_revocation_logic` | Integration specs, not in PR list |
| Password login (UI) | — | `prod_doctor_password_login_*` (nightly monitor) | Non-blocking; not in PR gate |

---

## Prioritized gaps (business risk)

1. **High — Doctor chrome after login:** partial via `practice_insights.spec.ts` + `navigation_feedback.spec.ts` (Agenda/Insights/Settings/More tabs; More menu; no mobile manual-booking FAB). Desktop dropdown not E2E-tested.
2. **Medium — Footer visibility rules:** marketing vs `AuthAboutFooter` by route (previously `footer_navigation`). Manual/visual regression risk only.
3. **Medium — Auth/session edge cases:** revocation, multi-session; have integration files but not in PR gate.
4. **Lower — PWA install banner, brand consistency:** specs exist; optional for merge.

---

## Proposed minimal future test set (when re-adding coverage)

Add **only** after meeting criteria in `docs/ci-test-policy.md` (Reintroduction criteria):

1. **UserBar smoke (signed-out only)** — assert `userbar-toggle` and `userbar-mobile-tabs` absent on `/` and `/login`. No Supabase calls. ~2 assertions, desktop + one mobile viewport optional in same file with `test.describe.configure({ mode: 'parallel' })` or separate projects.
2. **Footer smoke (signed-out only)** — assert `marketing-footer` test id on `/` and `/blog`; assert `auth-about-footer` count 0 on those routes. No login.
3. **Authenticated chrome (optional, non-blocking first)** — single desktop test: session cookie helper + “can open agenda” only; skip if Auth API returns retryable errors (explicit `test.skip` with reason). Run on schedule until stable, then promote.

Do **not** reintroduce PR-blocking suites that call `signInWithPassword` on every test until Auth schema errors are eliminated at the source (Supabase project health / rate limits / hooks).
