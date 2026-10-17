import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { seedProfessionalSpecialty } from "./helpers/test-doctor";

/**
 * The Finder's profile pop-up (mockup F; user, 2026-10-17): every card link to more about a
 * registered professional opens her profile over the Finder, booking included, so the
 * patient never leaves the results. Nothing is booked here (no request is sent).
 *
 * A professional with an open clinic in Paphos, a paused one in Nicosia and two services.
 */

type Created = { professionalId: string; authUserId: string; clinicIds: string[] };

type Seeded = {
  name: string;
  paphosClinic: string;
  nicosiaClinic: string;
  paphosJoinId: string;
};

const SCHEDULE = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
  start_time: "09:00:00",
  end_time: "17:00:00",
  slot_duration_minutes: 30,
};

async function seedTwoClinicProfessional(
  admin: SupabaseClient,
  nonce: string,
  created: Created,
): Promise<Seeded> {
  const email = `finder-popup-${nonce}@integration.test`;
  const name = `Popup Pro ${nonce}`;

  const auth = await admin.auth.admin.createUser({
    email,
    password: "StrongPass123!",
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (auth.error || !auth.data.user?.id) throw new Error(`auth user: ${auth.error?.message}`);
  created.authUserId = auth.data.user.id;

  const insert = await admin
    .from("professionals")
    .insert({
      auth_user_id: auth.data.user.id,
      name,
      registration_email: email,
      email,
      mobile_number: "+35799123458",
      languages: ["English", "Greek"],
      slug: `finder-popup-${nonce}`,
      is_registered: true,
      pro_access_until: new Date(Date.now() + 180 * 86_400_000).toISOString(),
      is_archived: false,
      is_test_profile: true,
      subscription_tier: "standard",
    })
    .select("id")
    .single();
  if (insert.error || !insert.data?.id) throw new Error(`professional: ${insert.error?.message}`);
  const professionalId = String(insert.data.id);
  created.professionalId = professionalId;

  await seedProfessionalSpecialty(admin, professionalId, {
    specialty: "Dentistry",
    licenseNumber: `LIC-FP-${nonce}`,
  });
  // She shows her mobile on her profile, so her cards' hero offers "Show mobile" (mockup L).
  const settings = await admin
    .from("professional_settings")
    .upsert({ professional_id: professionalId, show_mobile_on_profile: true }, { onConflict: "professional_id" });
  if (settings.error) throw new Error(`settings: ${settings.error.message}`);

  const clinics = [
    { district: "Paphos", town: "Geroskipou", latitude: 34.7602, longitude: 32.4506 },
    { district: "Nicosia", town: "Strovolos", latitude: 35.1446, longitude: 33.3416 },
  ];
  const names: string[] = [];
  const joinIds: string[] = [];
  for (const [index, place] of clinics.entries()) {
    const clinicName = `Popup Pro ${place.district} ${nonce}`;
    const clinic = await admin
      .from("clinics")
      .insert({
        name: clinicName,
        slug: `finder-popup-${place.district.toLowerCase()}-${nonce}`,
        district: place.district,
        town: place.town,
        address: `${nonce} Popup Street, ${place.town}, Cyprus`,
        phone: "26123457",
        latitude: place.latitude,
        longitude: place.longitude,
        is_archived: false,
      })
      .select("id")
      .single();
    if (clinic.error || !clinic.data?.id) throw new Error(`clinic: ${clinic.error?.message}`);
    created.clinicIds.push(String(clinic.data.id));
    names.push(clinicName);

    const join = await admin
      .from("professional_clinics")
      .insert({
        professional_id: professionalId,
        clinic_id: String(clinic.data.id),
        sort_order: index,
        // Paphos open, Nicosia paused.
        pause_online_bookings: index === 1,
        ...SCHEDULE,
      })
      .select("id")
      .single();
    if (join.error || !join.data?.id) throw new Error(`join row: ${join.error?.message}`);
    joinIds.push(String(join.data.id));
  }

  // Two of her services, offered as chips in the pop-up.
  const services = await admin.from("professional_services").insert([
    { professional_id: professionalId, name: `Check-up ${nonce}` },
    { professional_id: professionalId, name: `Cleaning ${nonce}` },
  ]);
  if (services.error) throw new Error(`services: ${services.error.message}`);

  return {
    name,
    paphosClinic: names[0]!,
    nicosiaClinic: names[1]!,
    paphosJoinId: joinIds[0]!,
  };
}

async function cleanup(admin: SupabaseClient, created: Created) {
  if (created.professionalId) {
    await admin.from("user_events").delete().eq("professional_id", created.professionalId);
    await admin.from("professional_services").delete().eq("professional_id", created.professionalId);
    await admin.from("professional_specialties").delete().eq("professional_id", created.professionalId);
    await admin.from("professional_settings").delete().eq("professional_id", created.professionalId);
    await admin.from("professionals").delete().eq("id", created.professionalId);
  }
  if (created.clinicIds.length) await admin.from("clinics").delete().in("id", created.clinicIds);
  if (created.authUserId) await admin.auth.admin.deleteUser(created.authUserId);
}

function herCard(page: Page, name: string) {
  return page.locator("section.mt-6 article").filter({ has: page.getByText(name, { exact: true }) }).first();
}

test.describe("Integration: the Finder's profile pop-up", { tag: ["@pr-e2e"] }, () => {
  test.describe.configure({ mode: "serial" });

  const created: Created = { professionalId: "", authUserId: "", clinicIds: [] };
  let seeded: Seeded;
  let admin: SupabaseClient;
  let nonce: string;

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    seeded = await seedTwoClinicProfessional(admin, nonce, created);
  });

  test.afterAll(async () => {
    if (admin) await cleanup(admin, created);
  });

  test("her name opens her profile over the Finder; Back closes it and the Finder stays", async ({ page }) => {
    await page.goto(`/paphos/dentist?name=${encodeURIComponent(seeded.name)}`);
    const finderUrl = page.url();
    const card = herCard(page, seeded.name);
    await expect(card).toBeVisible({ timeout: 30_000 });

    const popup = page.getByTestId("finder-profile-popup");
    await expect(async () => {
      await card.getByRole("link", { name: seeded.name, exact: true }).click();
      await expect(popup).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    expect(page.url()).toBe(finderUrl);

    await expect(popup.getByRole("heading", { name: seeded.name })).toBeVisible();
    await expect(popup.getByTestId("finder-popup-full-profile")).toHaveAttribute("href", /finder-popup-/);
    // Choose a clinic: both of hers, the card's (Paphos) chosen, the paused one says call.
    const options = popup.getByTestId("profile-clinic-option");
    await expect(options).toHaveCount(2, { timeout: 20_000 });
    await expect(options.nth(0)).toContainText(seeded.paphosClinic);
    await expect(options.nth(0).locator("[aria-current=true]")).toHaveCount(1);
    await expect(options.nth(1)).toContainText("Call to book");
    await expect(popup.getByRole("button", { name: "Book this time" })).toBeVisible({ timeout: 20_000 });

    await page.goBack();
    await expect(popup).toHaveCount(0, { timeout: 10_000 });
    expect(page.url()).toBe(finderUrl);
    await expect(card).toBeVisible();
  });

  test("a service chip, then Book this time: the form opens over the Finder with that service", async ({ page }) => {
    await page.goto(`/paphos/dentist?name=${encodeURIComponent(seeded.name)}`);
    const finderUrl = page.url();
    const card = herCard(page, seeded.name);
    const popup = page.getByTestId("finder-profile-popup");
    await expect(async () => {
      await card.getByRole("link", { name: seeded.name, exact: true }).click();
      await expect(popup).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    const chip = popup.getByTestId("finder-popup-services").getByRole("button", { name: `Cleaning ${nonce}` });
    await expect(chip).toBeVisible({ timeout: 20_000 });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await popup.getByRole("button", { name: "Book this time" }).click();

    const form = page.getByTestId("profile-booking-dialog");
    await expect(form).toBeVisible({ timeout: 10_000 });
    await expect(form).toContainText(`Booking: Cleaning ${nonce}`);
    await expect(form).toContainText(seeded.paphosClinic);
    expect(page.url()).toBe(finderUrl);

    // Escape leaves the form, not the pop-up; the close button leaves the pop-up.
    await page.keyboard.press("Escape");
    await expect(form).toHaveCount(0);
    await expect(popup).toBeVisible();
    await popup.getByTestId("finder-popup-close").click();
    await expect(popup).toHaveCount(0, { timeout: 10_000 });
    expect(page.url()).toBe(finderUrl);
  });

  test("a time on the card opens the booking form for that time, without leaving the Finder", async ({ page }) => {
    await page.goto(`/paphos/dentist?name=${encodeURIComponent(seeded.name)}`);
    const finderUrl = page.url();
    const card = herCard(page, seeded.name);
    await expect(card.getByTestId("finder-card-day-strip")).toBeVisible({ timeout: 30_000 });
    const nextFree = card.getByRole("button", { name: /^Next free:/ });
    if (await nextFree.isVisible()) await nextFree.click();

    const time = card.getByTestId("finder-card-times").getByRole("link").first();
    await expect(time).toBeVisible({ timeout: 20_000 });
    const label = String(await time.getAttribute("aria-label"));
    const hhmm = label.match(/(\d{2}:\d{2})$/)?.[1];
    expect(hhmm).toBeTruthy();

    const form = page.getByTestId("profile-booking-dialog");
    await expect(async () => {
      await time.click();
      await expect(form).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await expect(form).toContainText(hhmm!);
    await expect(form).toContainText(seeded.paphosClinic);
    expect(page.url()).toBe(finderUrl);
  });
});
