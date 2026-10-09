import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { seedProfessionalSpecialty } from "./helpers/test-doctor";

/**
 * Point D2: practice locations are read from professional_clinics -> clinics, and since
 * D4 (doctor_locations dropped) nothing else. Each test seeds clinic links the way an
 * approved registration writes them and asserts the public profile shows what the JOIN
 * clinic says: DocCy's clinic name (never the join row's own label, user 2026-10-01), the
 * clinic's address, and no archived
 * clinic.
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
      registration_email: email,
      email,
      languages: ["English"],
      slug,
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

  await seedProfessionalSpecialty(admin, professionalId, {
    specialty: "Dentistry",
    licenseNumber: `LIC-D2-${nonce}`,
  });

  return { professionalId, authUserId: auth.data.user.id, clinicIds: [], slug };
}

/** A clinic and this professional's link to it, open for bookings. Returns the link id. */
async function addClinic(
  admin: SupabaseClient,
  created: Created,
  input: { address: string; isPrimary: boolean; sortOrder: number },
): Promise<string> {
  const token = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const clinic = await admin
    .from("clinics")
    .insert({
      name: `D2 Clinic ${token}`,
      slug: `d2-clinic-${token}`,
      district: "Paphos",
      town: "Paphos",
      address: input.address,
      phone: "26123456",
    })
    .select("id")
    .single();
  if (clinic.error || !clinic.data?.id) throw new Error(`clinic: ${clinic.error?.message}`);
  created.clinicIds.push(String(clinic.data.id));

  const link = await admin
    .from("professional_clinics")
    .insert({
      professional_id: created.professionalId,
      clinic_id: clinic.data.id,
      is_primary: input.isPrimary,
      sort_order: input.sortOrder,
      pause_online_bookings: false,
    })
    .select("id")
    .single();
  if (link.error || !link.data?.id) throw new Error(`clinic link: ${link.error?.message}`);
  return String(link.data.id);
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
  test("the public profile renders DocCy's clinic name and address", async ({ page }) => {
    // Two SSR renders plus seeding; the default budget is not enough.
    test.setTimeout(120_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const created: Created = { professionalId: "", authUserId: "", clinicIds: [] };

    try {
      const seeded = await seedProfessional(admin, nonce);
      created.professionalId = seeded.professionalId;
      created.authUserId = seeded.authUserId;

      const primaryId = await addClinic(admin, created, {
        address: `First Street ${nonce}, Paphos, Cyprus`,
        isPrimary: true,
        sortOrder: 0,
      });
      // The profile only names clinics when there is more than one, so give the
      // professional a second one.
      await addClinic(admin, created, {
        address: `Second Street ${nonce}, Paphos, Cyprus`,
        isPrimary: false,
        sortOrder: 1,
      });
      const clinicId = await clinicIdFor(admin, primaryId);

      // An old per-doctor label must not rename the clinic for patients: the clinic row
      // holds the name and the address.
      const joinUpdate = await admin
        .from("professional_clinics")
        .update({ label: `Join Row Clinic ${nonce}` })
        .eq("id", primaryId);
      if (joinUpdate.error) throw new Error(`join update: ${joinUpdate.error.message}`);

      const clinicUpdate = await admin
        .from("clinics")
        .update({ name: `DocCy Clinic ${nonce}`, address: `Join Row Street ${nonce}, Paphos, Cyprus` })
        .eq("id", clinicId);
      if (clinicUpdate.error) throw new Error(`clinic update: ${clinicUpdate.error.message}`);

      await page.goto(`/en/${seeded.slug}`);

      await expect(page.getByText(`Join Row Clinic ${nonce}`)).toHaveCount(0);
      await expect(page.getByText(`DocCy Clinic ${nonce}`).first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(`Join Row Street ${nonce}`).first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(`First Street ${nonce}`)).toHaveCount(0);
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

      await addClinic(admin, created, {
        address: `Kept Street ${nonce}, Paphos, Cyprus`,
        isPrimary: true,
        sortOrder: 0,
      });
      const archivedId = await addClinic(admin, created, {
        address: `Archived Street ${nonce}, Paphos, Cyprus`,
        isPrimary: false,
        sortOrder: 1,
      });
      const archivedClinic = await clinicIdFor(admin, archivedId);

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
