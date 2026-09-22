import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "../../helpers/doctorAuth";

export const INTEGRATION_DOCTOR_PASSWORD = "StrongPass123!";

export type TestDoctorFixture = {
  admin: SupabaseClient;
  authUserId: string;
  doctorId: string;
  email: string;
  password: string;
  slug: string;
};

type CreateTestDoctorInput = {
  admin: SupabaseClient;
  nonce: string;
  name: string;
  specialty: string;
  is_specialty_approved: boolean;
  status: "pending" | "verified" | "rejected";
  /** Default true so agenda tests are not blocked by the one-time welcome modal. */
  markTrialNoticeSeen?: boolean;
  subscription_tier?: "founder" | "standard";
};

export async function createTestDoctor(
  input: CreateTestDoctorInput,
): Promise<TestDoctorFixture> {
  const email = `access-${input.nonce}@integration.test`;
  const slug = `access-${input.nonce}`;
  const password = INTEGRATION_DOCTOR_PASSWORD;

  const createUserRes = await input.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (createUserRes.error || !createUserRes.data.user?.id) {
    throw new Error(`Failed creating auth user: ${createUserRes.error?.message}`);
  }
  const authUserId = createUserRes.data.user.id;

  const doctorInsert = await input.admin
    .from("professionals")
    .insert({
      auth_user_id: authUserId,
      name: input.name,
      email,
      phone: "+35799123456",
      languages: ["English"],
      license_file_url: `licenses/integration/${input.nonce}.pdf`,
      status: input.status,
      slug,
      subscription_tier: input.subscription_tier ?? "standard",
      trial_notice_seen_at:
        input.markTrialNoticeSeen === false ? null : new Date().toISOString(),
      is_registered: true,
      has_online_booking: true,
      finder_visible: true,
      is_archived: false,
      is_test_profile: true,
    })
    .select("id")
    .single();

  if (doctorInsert.error || !doctorInsert.data?.id) {
    await input.admin.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed creating doctor: ${doctorInsert.error?.message}`);
  }

  const doctorId = String(doctorInsert.data.id);
  const specialtyInsert = await input.admin.from("professional_specialties").insert(
    {
      professional_id: doctorId,
      specialty: input.specialty,
      license_number: `LIC-${input.nonce}`,
      is_approved: input.is_specialty_approved,
    },
  );
  if (specialtyInsert.error) {
    await input.admin.from("professionals").delete().eq("id", doctorId);
    await input.admin.auth.admin.deleteUser(authUserId);
    throw new Error(
      `Failed creating professional_specialties: ${specialtyInsert.error.message}`,
    );
  }

  return {
    admin: input.admin,
    authUserId,
    doctorId,
    email,
    password,
    slug,
  };
}

/**
 * Gives a seeded professional its specialty the way /register does: a
 * professional_specialties row (the professionals columns are derived/legacy).
 */
export async function seedProfessionalSpecialty(
  admin: SupabaseClient,
  professionalId: string,
  input: { specialty: string; licenseNumber?: string | null; isApproved?: boolean },
): Promise<void> {
  const { error } = await admin.from("professional_specialties").insert({
    professional_id: professionalId,
    specialty: input.specialty,
    license_number: input.licenseNumber ?? null,
    is_approved: input.isApproved ?? true,
  });
  if (error) throw new Error(`Failed creating professional_specialties: ${error.message}`);
}

export async function deleteTestDoctor(fixture: TestDoctorFixture): Promise<void> {
  const { admin, doctorId, authUserId } = fixture;
  if (doctorId) {
    await admin.from("professional_specialties").delete().eq("professional_id", doctorId);
    await admin.from("doctor_locations").delete().eq("doctor_id", doctorId);
    await admin.from("doctor_services").delete().eq("doctor_id", doctorId);
    await admin.from("professional_settings").delete().eq("professional_id", doctorId);
    await admin.from("professionals").delete().eq("id", doctorId);
  }
  if (authUserId) {
    await admin.auth.admin.deleteUser(authUserId);
  }
}

/**
 * Approving a custom label adds it to the `specialties` catalogue, where it would
 * stay after the test (and show in Testing's dropdowns). Call after
 * `deleteTestDoctor`: deletes the catalogue row by name unless something still uses
 * it (the foreign key from professional_specialties is RESTRICT).
 */
export async function deleteTestCatalogueSpecialty(
  admin: SupabaseClient,
  name: string,
): Promise<void> {
  const row = await admin.from("specialties").select("id").eq("name", name).maybeSingle();
  if (row.error || !row.data?.id) return;
  const used = await admin
    .from("professional_specialties")
    .select("id", { count: "exact", head: true })
    .eq("specialty_id", row.data.id);
  if (used.error || (used.count ?? 0) > 0) return;
  await admin.from("specialties").delete().eq("id", row.data.id);
}

/** Programmatic session (stable on CI with `npm run start` + 127.0.0.1). */
export async function loginDoctorUi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await signInDoctorAndSetCookies(page, undefined, { email, password });
  await page.goto("/");
}

/**
 * Sign in the way a doctor does from the verified-account email: open the
 * login URL from the message, fill the form, land on `next` (usually /agenda).
 */
export async function signInDoctorViaEmailLoginUrl(
  page: Page,
  loginUrl: string,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(loginUrl);
  await expect(page).toHaveURL(/\/login/);
  await expect(page).toHaveURL(/next=/);
  const submit = page.getByRole("button", { name: /^Sign in$/i });
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await submit.click();
}
