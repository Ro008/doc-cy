import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { gotoPublicAndReady } from "./helpers/assertNoCloudflareChallenge";
import { dismissCookieConsentIfPresent } from "./helpers/dismissCookieConsent";

/**
 * Read-only replacement for the nightly guest-booking smoke.
 *
 * The old booking suite completed a real booking against a permanent test doctor in
 * production. That doctor is gone on purpose (no test profiles in production), so this
 * checks the same public funnel up to, but not including, the write:
 *
 *   - a real professional's public profile renders with their name;
 *   - the booking section mounts;
 *   - availability resolves to a known state rather than an error.
 *
 * It creates nothing, submits nothing and emails nobody. Completing a booking is still
 * covered on demand by prod_appointment_booking_flow.spec.ts, which is run by hand with
 * a temporary doctor around risky releases.
 *
 * The professional is resolved at runtime rather than hardcoded. A pinned slug is what
 * broke the previous nightly: TEST_BOOKING_DOCTOR_SLUG pointed at a deleted doctor and
 * the suite failed every night until someone noticed.
 */
test.describe("Prod smoke: professional profile availability", { tag: "@nightly-prod" }, () => {
  test("a real professional's profile renders its booking section", async ({ page }) => {
    test.setTimeout(120_000);

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production.",
    );
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase service credentials.");

    // Read-only: this suite must never write to production.
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from("professionals")
      .select("slug, name")
      .eq("is_registered", true)
      .eq("is_archived", false)
      .eq("is_test_profile", false)
      .eq("status", "verified")
      .not("slug", "is", null)
      .order("created_at", { ascending: true })
      .limit(1);

    expect(error, `Could not resolve a professional: ${error?.message ?? ""}`).toBeNull();

    const professional = (data ?? [])[0] as { slug?: string; name?: string } | undefined;
    const slug = String(professional?.slug ?? "").trim();
    const name = String(professional?.name ?? "").trim();

    // Not an assertion failure: a directory with no registered professionals yet is a
    // valid state, and failing here nightly would be noise rather than a signal.
    test.skip(
      !slug,
      "No verified, registered, non-test professional in production to check.",
    );

    await gotoPublicAndReady(page, `/en/${slug}`);
    await dismissCookieConsentIfPresent(page);

    // The profile rendered with real data, not an error shell.
    //
    // Substring match on purpose: the h1's accessible name is the professional's name
    // concatenated with their specialty and district ("Stephan MeyerPsychologyPaphos"),
    // so an exact match fails.
    const nameInHeading = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    await expect(page.getByRole("heading", { name: nameInHeading, level: 1 })).toBeVisible({
      timeout: 20_000,
    });

    // The booking section mounted. This heading is present in every booking state.
    await expect(
      page.getByRole("heading", { name: /^Book an appointment$/i }),
    ).toBeVisible({ timeout: 20_000 });

    // Availability resolved to one of its known states. Which one depends on the
    // professional's own settings (paused, on holiday, no schedule published), so
    // asserting a calendar specifically would go red for reasons that are not faults.
    const knownBookingState = page
      .getByText(
        /Select a date on the calendar|Bookings temporarily unavailable|Appointments are paused|has not published availability yet|No available times right now/i,
      )
      .first();
    await expect(knownBookingState).toBeVisible({ timeout: 20_000 });
  });
});
