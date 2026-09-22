import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { seedProfessionalSpecialty } from "./helpers/test-doctor";

/**
 * Point D2: practice locations are read from professional_clinics -> clinics.
 *
 * Proving that takes more than "the page still works": doctor_locations and its join
 * row are mirrors, so identical data proves nothing. Each test here makes the two
 * disagree on purpose — writing to the join row and its clinic only — and then asserts
 * the public profile shows what the JOIN ROW says. Before D2 it showed the location's
 * value, so these fail on the old read path.
 */

type Created = { professionalId: string; authUserId: string; clinicIds: string[] };

async function seedProfessional(
  admin: SupabaseClient,
  nonce: string,
): Promise<Created & { slug: string }> {
  const email = `d2-locations-${nonce}@integration.test`;
  const slug = `d2-locations-${nonce}`;

  const auth = await admin.auth.admin.createUser({
    email,
    password: "StrongPass123!",
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (auth.error || !auth.data.user?.id) throw new Error(`auth user: ${auth.error?.message}`);

  const insert = await admin
    .from("professionals")
    .insert({
      auth_user_id: auth.data.user.id,
      name: `D2 Locations Doctor ${nonce}`,
      district: "Paphos",
      registration_email: email,
      email,
      phone: "+35799123456",
      languages: ["English"],
      status: "verified",
      slug,
      is_registered: true,
      has_online_booking: true,
      finder_visible: true,
      is_archived: false,
      is_test_profile: true,
      subscription_tier: "standard",
    })
    .select("id")
    .single();
  if (insert.error || !insert.data?.id) throw new Error(`professional: ${insert.error?.message}`);
  const professionalId = String(insert.data.id);

  await seedProfessionalSpecialty(admin, professionalId, {
    specialty: "Dentistry",
    licenseNumber: `LIC-D2-${nonce}`,
    isApproved: true,
  });

  return { professionalId, authUserId: auth.data.user.id, clinicIds: [], slug };
}

/**
 * The location write path (unchanged in D2); D1's trigger mirrors it onto the join row.
 * Registering already created an addressless primary location, so the first clinic
 * fills that one in rather than inserting a second primary.
 */
async function setPrimaryLocation(
  admin: SupabaseClient,
  professionalId: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin
    .from("doctor_locations")
    .update({ district: "Paphos", ...fields })
    .eq("doctor_id", professionalId)
    .eq("is_primary", true)
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`primary location: ${error?.message}`);
  return String(data.id);
}

async function addLocation(
  admin: SupabaseClient,
  professionalId: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin
    .from("doctor_locations")
    .insert({ doctor_id: professionalId, district: "Paphos", is_primary: false, ...fields })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`location: ${error?.message}`);
  return String(data.id);
}

async function clinicIdFor(admin: SupabaseClient, joinId: string): Promise<string> {
  const { data, error } = await admin
    .from("professional_clinics")
    .select("clinic_id")
    .eq("id", joinId)
    .single();
  if (error || !data) throw new Error(`join row: ${error?.message}`);
  return String(data.clinic_id);
}

async function cleanup(admin: SupabaseClient, created: Created) {
  if (created.professionalId) {
    const { data } = await admin
      .from("professional_clinics")
      .select("clinic_id")
      .eq("professional_id", created.professionalId);
    created.clinicIds.push(...(data ?? []).map((row) => String(row.clinic_id)));
    await admin.from("professional_specialties").delete().eq("professional_id", created.professionalId);
    await admin.from("professionals").delete().eq("id", created.professionalId);
  }
  const clinicIds = [...new Set(created.clinicIds)].filter(Boolean);
  if (clinicIds.length) await admin.from("clinics").delete().in("id", clinicIds);
  if (created.authUserId) await admin.auth.admin.deleteUser(created.authUserId);
}

test.describe("Integration: locations read from professional_clinics", { tag: "@pr-e2e" }, () => {
  test("the public profile renders the join row's clinic name and address", async ({ page }) => {
    // Two SSR renders plus seeding; the default budget is not enough.
    test.setTimeout(120_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const created: Created = { professionalId: "", authUserId: "", clinicIds: [] };

    try {
      const seeded = await seedProfessional(admin, nonce);
      created.professionalId = seeded.professionalId;
      created.authUserId = seeded.authUserId;

      const locationId = await setPrimaryLocation(admin, seeded.professionalId, {
        clinic_address: "Location Table Street 1, Paphos, Cyprus",
        town: "Paphos",
        label: "From The Location Table",
        pause_online_bookings: false,
      });
      // The profile only names clinics when there is more than one, so give the
      // professional a second one.
      const secondId = await addLocation(admin, seeded.professionalId, {
        sort_order: 1,
        clinic_address: `Second Street ${nonce}, Paphos, Cyprus`,
        pause_online_bookings: false,
      });
      const clinicId = await clinicIdFor(admin, locationId);
      created.clinicIds.push(clinicId, await clinicIdFor(admin, secondId));

      // Make the two disagree: only the join row and its clinic get the new values.
      const joinUpdate = await admin
        .from("professional_clinics")
        .update({ label: `Join Row Clinic ${nonce}` })
        .eq("id", locationId);
      if (joinUpdate.error) throw new Error(`join update: ${joinUpdate.error.message}`);

      const clinicUpdate = await admin
        .from("clinics")
        .update({ address: `Join Row Street ${nonce}, Paphos, Cyprus` })
        .eq("id", clinicId);
      if (clinicUpdate.error) throw new Error(`clinic update: ${clinicUpdate.error.message}`);

      await page.goto(`/en/${seeded.slug}`);

      await expect(page.getByText(`Join Row Clinic ${nonce}`).first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(`Join Row Street ${nonce}`).first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText("From The Location Table")).toHaveCount(0);
      await expect(page.getByText("Location Table Street 1")).toHaveCount(0);
    } finally {
      await cleanup(admin, created);
    }
  });

  test("a clinic still being set up, with no address yet, is still listed", async ({ page }) => {
    // "Add clinic" in settings creates a location with no address, and the wizard fills
    // it in afterwards. The mirror cannot give that a join row (a clinic needs a
    // district), so reading only join rows would make the new clinic vanish.
    test.setTimeout(120_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const created: Created = { professionalId: "", authUserId: "", clinicIds: [] };

    try {
      const seeded = await seedProfessional(admin, nonce);
      created.professionalId = seeded.professionalId;
      created.authUserId = seeded.authUserId;

      const primaryId = await setPrimaryLocation(admin, seeded.professionalId, {
        clinic_address: `Only Street ${nonce}, Paphos, Cyprus`,
        pause_online_bookings: false,
      });
      created.clinicIds.push(await clinicIdFor(admin, primaryId));

      // Exactly what POST /api/doctor-locations writes: no address, no district.
      await addLocation(admin, seeded.professionalId, {
        sort_order: 1,
        district: null,
        clinic_address: null,
        pause_online_bookings: false,
      });

      await page.goto(`/en/${seeded.slug}`);

      await expect(page.getByText(/2 clinics/i).first()).toBeVisible({ timeout: 20_000 });
    } finally {
      await cleanup(admin, created);
    }
  });

  test("a clinic archived on the join side stops being offered", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const created: Created = { professionalId: "", authUserId: "", clinicIds: [] };

    try {
      const seeded = await seedProfessional(admin, nonce);
      created.professionalId = seeded.professionalId;
      created.authUserId = seeded.authUserId;

      const keptId = await setPrimaryLocation(admin, seeded.professionalId, {
        clinic_address: `Kept Street ${nonce}, Paphos, Cyprus`,
        pause_online_bookings: false,
      });
      const archivedId = await addLocation(admin, seeded.professionalId, {
        sort_order: 1,
        clinic_address: `Archived Street ${nonce}, Paphos, Cyprus`,
        pause_online_bookings: false,
      });
      const keptClinic = await clinicIdFor(admin, keptId);
      const archivedClinic = await clinicIdFor(admin, archivedId);
      created.clinicIds.push(keptClinic, archivedClinic);

      const archive = await admin
        .from("clinics")
        .update({ is_archived: true })
        .eq("id", archivedClinic);
      if (archive.error) throw new Error(`archive: ${archive.error.message}`);

      await page.goto(`/en/${seeded.slug}`);

      await expect(page.getByText(`Kept Street ${nonce}`).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(`Archived Street ${nonce}`)).toHaveCount(0);
    } finally {
      await cleanup(admin, created);
    }
  });
});
