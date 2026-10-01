import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  createTestDoctor,
  deleteTestClinics,
  deleteTestDoctor,
  loginDoctorUi,
  openPrimaryClinicForBookings,
  seedProfessionalSpecialty,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * Every public phone is the clinic's phone (user, 2026-09-29):
 * - listings and registered professionals alike show `clinics.phone`, one per clinic,
 *   whether or not the clinic takes online bookings;
 * - the scraped `professionals.phone` is never shown, not even as a fallback;
 * - the settings page shows the clinic phone read-only, and sends you to Clinics to
 *   change it (one way to change a clinic: "Request a change" on its card).
 */
test.describe("Integration: public phone comes from the clinic", { tag: "@pr-e2e" }, () => {
  // Server-rendered pages plus a sign-in: the default 30s leaves no room on a cold server.
  test.describe.configure({ retries: 0, timeout: 120_000 });

  let admin: SupabaseClient;
  const nonce = `pp${Date.now()}`.slice(-12);
  const random8 = (prefix: string) =>
    `${prefix}${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
  const clinicPhone = random8("22");
  const scrapedPhone = random8("99");
  const mobile = `+357${random8("96")}`;
  const clinicIds: string[] = [];
  let listingId = "";
  let listingSlug = "";
  let phonelessClinicId = "";
  let registered: TestDoctorFixture | null = null;

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());

    const { data: clinic, error: clinicError } = await admin
      .from("clinics")
      .insert({
        name: `Phoneless Clinic ${nonce}`,
        slug: `phoneless-clinic-${nonce}`,
        district: "Nicosia",
        town: "Nicosia",
        address: `${nonce} Phoneless Street, Nicosia`,
        phone: null,
      })
      .select("id")
      .single();
    if (clinicError || !clinic) throw new Error(`clinic: ${clinicError?.message}`);
    phonelessClinicId = String(clinic.id);
    clinicIds.push(phonelessClinicId);

    listingSlug = `phone-listing-${nonce}`;
    const { data: listing, error: listingError } = await admin
      .from("professionals")
      .insert({
        name: `Phone Listing ${nonce}`,
        slug: listingSlug,
        district: "Nicosia",
        phone: scrapedPhone,
        is_registered: false,
        is_archived: false,
        is_test_profile: true,
        finder_visible: true,
      })
      .select("id")
      .single();
    if (listingError || !listing) throw new Error(`listing: ${listingError?.message}`);
    listingId = String(listing.id);
    await seedProfessionalSpecialty(admin, listingId, { specialty: "Cardiology" });
    const { error: linkError } = await admin.from("professional_clinics").insert({
      professional_id: listingId,
      clinic_id: phonelessClinicId,
      is_primary: true,
      sort_order: 0,
    });
    if (linkError) throw new Error(`listing link: ${linkError.message}`);

    registered = await createTestDoctor({
      admin,
      nonce,
      name: `Clinic Phone ${nonce.slice(-4)}`,
      specialty: "Cardiology",
      is_specialty_approved: true,
      status: "verified",
    });
    const opened = await openPrimaryClinicForBookings(admin, registered.doctorId, nonce);
    clinicIds.push(opened.clinicId);
    const { error: phoneError } = await admin
      .from("clinics")
      .update({ phone: clinicPhone, name: `Clinic Phone Practice ${nonce}` })
      .eq("id", opened.clinicId);
    if (phoneError) throw new Error(`clinic phone: ${phoneError.message}`);
    // The Call switch off and the mobile set: neither may change what patients see.
    await admin
      .from("professionals")
      .update({ mobile_number: mobile, phone: `+357${scrapedPhone}` })
      .eq("id", registered.doctorId);
    await admin
      .from("professional_settings")
      .update({ show_phone_public: false, public_phone_source: "mobile" })
      .eq("professional_id", registered.doctorId);
  });

  test.afterAll(async () => {
    if (listingId) await admin.from("professionals").delete().eq("id", listingId);
    if (registered) await deleteTestDoctor(registered);
    await deleteTestClinics(admin, clinicIds);
  });

  test("the reveal API never falls back to the scraped listing phone", async ({ request }) => {
    const clinic = await request.post("/api/directory/contact-reveal", {
      data: { kind: "clinic", id: phonelessClinicId, manualId: listingId },
    });
    expect(clinic.status()).toBe(200);
    expect((await clinic.json()).phone).toBeNull();

    for (const kind of ["manual", "registered"]) {
      const res = await request.post("/api/directory/contact-reveal", {
        data: { kind, id: kind === "manual" ? listingId : registered!.doctorId },
      });
      expect(res.status(), kind).toBe(400);
    }
  });

  test("a listing whose clinic has no phone shows no phone button", async ({ page }) => {
    await page.goto(`/en/${listingSlug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(`Phoneless Clinic ${nonce}`).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /Show phone number/i })).toHaveCount(0);
  });

  test("a registered profile shows the clinic phone with bookings open and Call off", async ({
    page,
  }) => {
    await page.goto(`/en/${registered!.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Contact$/i })).toBeVisible({
      timeout: 20_000,
    });
    const call = page.getByRole("button", { name: /^Call$/i });
    await expect(call).toHaveCount(1);
    const revealed = page.locator('a[href^="tel:"]').first();
    // The profile is server-rendered: a click before hydration does nothing, so retry.
    await expect(async () => {
      if (await call.isVisible()) await call.click();
      await expect(revealed).toHaveAttribute("href", `tel:+357${clinicPhone}`, {
        timeout: 3_000,
      });
    }).toPass({ timeout: 30_000 });
    await expect(page.locator(`a[href="tel:${mobile}"]`)).toHaveCount(0);
  });

  test("settings show the clinic phone read-only", async ({ page }) => {
    await loginDoctorUi(page, registered!.email, registered!.password);
    await page.goto("/settings?section=contact", { waitUntil: "domcontentloaded" });
    const phones = page.getByTestId("settings-clinic-phones");
    await expect(phones).toBeVisible({ timeout: 20_000 });
    await expect(phones).toContainText(`Clinic Phone Practice ${nonce}`);
    await expect(phones).toContainText(`+357 ${clinicPhone.slice(0, 2)} ${clinicPhone.slice(2)}`);
    await expect(phones).not.toContainText(/contact us/i);
    await expect(phones).toContainText("To change a clinic’s phone, go to Clinics and use Request a change.");
    await phones.getByRole("link", { name: "Clinics" }).click();
    await expect(page).toHaveURL(/section=clinics/);
    await expect(page.getByRole("heading", { level: 1, name: "Clinics" })).toBeVisible();
    await expect(
      page.getByTestId("settings-clinic-card").first().getByRole("button", { name: "Request a change" }),
    ).toBeVisible();
    await expect(page.locator("#clinicPhone")).toHaveCount(0);
    await expect(page.getByRole("switch", { name: /Show a Call button/i })).toHaveCount(0);
  });
});
