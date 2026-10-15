import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { seedProfessionalSpecialty } from "./helpers/test-doctor";

/**
 * One finder card per professional + clinic (user, 2026-10-15).
 *
 * A professional with an open clinic in Paphos and a paused one in Nicosia: a Paphos
 * search shows only the Paphos card; a search by her name shows both, the open clinic
 * first; each card books at its own clinic; and every card is the same size until the
 * patient opens more times.
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
  const email = `clinic-cards-${nonce}@integration.test`;
  const name = `Clinic Cards ${nonce}`;

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
      mobile_number: "+35799123457",
      languages: ["English", "Greek"],
      slug: `clinic-cards-${nonce}`,
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
    licenseNumber: `LIC-CC-${nonce}`,
  });

  const clinics = [
    { district: "Paphos", town: "Geroskipou", latitude: 34.7602, longitude: 32.4506 },
    { district: "Nicosia", town: "Strovolos", latitude: 35.1446, longitude: 33.3416 },
  ];
  const names: string[] = [];
  const joinIds: string[] = [];
  for (const [index, place] of clinics.entries()) {
    const clinicName = `Clinic Cards ${place.district} ${nonce}`;
    const clinic = await admin
      .from("clinics")
      .insert({
        name: clinicName,
        slug: `clinic-cards-${place.district.toLowerCase()}-${nonce}`,
        district: place.district,
        town: place.town,
        address: `${nonce} Card Street, ${place.town}, Cyprus`,
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

  return {
    name,
    paphosClinic: names[0]!,
    nicosiaClinic: names[1]!,
    paphosJoinId: joinIds[0]!,
  };
}

async function cleanup(admin: SupabaseClient, created: Created) {
  if (created.professionalId) {
    await admin.from("professional_specialties").delete().eq("professional_id", created.professionalId);
    await admin.from("professional_settings").delete().eq("professional_id", created.professionalId);
    await admin.from("professionals").delete().eq("id", created.professionalId);
  }
  if (created.clinicIds.length) await admin.from("clinics").delete().in("id", created.clinicIds);
  if (created.authUserId) await admin.auth.admin.deleteUser(created.authUserId);
}

function herCards(page: Page, name: string) {
  return page.locator("section.mt-6 article").filter({ has: page.getByText(name, { exact: true }) });
}

test.describe("Integration: one finder card per professional and clinic", { tag: ["@pr-e2e"] }, () => {
  test.describe.configure({ mode: "serial" });

  const created: Created = { professionalId: "", authUserId: "", clinicIds: [] };
  let seeded: Seeded;
  let admin: SupabaseClient;

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    seeded = await seedTwoClinicProfessional(admin, nonce, created);
  });

  test.afterAll(async () => {
    if (admin) await cleanup(admin, created);
  });

  test("a Paphos search shows only her Paphos clinic", async ({ page }) => {
    await page.goto(`/paphos/dentist?name=${encodeURIComponent(seeded.name)}`);
    const cards = herCards(page, seeded.name);
    await expect(cards).toHaveCount(1, { timeout: 30_000 });
    await expect(cards.first()).toContainText(seeded.paphosClinic, { timeout: 20_000 });
    await expect(cards.first()).not.toContainText(seeded.nicosiaClinic);
  });

  test("her name shows a card per clinic, the open clinic first, each booking there", async ({ page }) => {
    await page.goto(`/?name=${encodeURIComponent(seeded.name)}`);
    const cards = herCards(page, seeded.name);
    await expect(cards).toHaveCount(2, { timeout: 30_000 });

    const open = cards.nth(0);
    const paused = cards.nth(1);
    await expect(open).toContainText(seeded.paphosClinic, { timeout: 20_000 });
    await expect(paused).toContainText(seeded.nicosiaClinic, { timeout: 20_000 });
    await expect(paused.getByTestId("finder-card-booking-paused")).toBeVisible({ timeout: 20_000 });
    await expect(open.getByTestId("finder-card-booking-paused")).toHaveCount(0);

    // A time on the open card books at that clinic.
    const slot = open.locator(`a[href*="location=${seeded.paphosJoinId}"]`).first();
    await expect(slot).toBeVisible({ timeout: 20_000 });

    // Same size, paused or not.
    const [openBox, pausedBox] = await Promise.all([open.boundingBox(), paused.boundingBox()]);
    expect(openBox && pausedBox).toBeTruthy();
    expect(Math.abs(openBox!.height - pausedBox!.height)).toBeLessThanOrEqual(1);
  });

  test("only the card whose times are opened grows", async ({ page }) => {
    await page.goto(`/?name=${encodeURIComponent(seeded.name)}`);
    const cards = herCards(page, seeded.name);
    await expect(cards).toHaveCount(2, { timeout: 30_000 });
    const open = cards.nth(0);
    const paused = cards.nth(1);
    const more = open.getByRole("button", { name: /^Show \d+ more times/ }).first();
    await expect(more).toBeVisible({ timeout: 20_000 });

    const before = (await open.boundingBox())!.height;
    const pausedBefore = (await paused.boundingBox())!.height;
    await expect(async () => {
      await more.click();
      await expect(open.getByTestId("finder-card-slot-grid")).toHaveAttribute("data-expanded", "true", {
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });

    await expect.poll(async () => (await open.boundingBox())!.height, { timeout: 10_000 }).toBeGreaterThan(before);
    expect((await paused.boundingBox())!.height).toBeCloseTo(pausedBefore, 0);
  });
});
