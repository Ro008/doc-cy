import type { Page } from "@playwright/test";
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
    .from("doctors")
    .insert({
      auth_user_id: authUserId,
      name: input.name,
      specialty: input.specialty,
      specialties: [input.specialty],
      email,
      phone: "+35799123456",
      languages: ["English"],
      license_number: `LIC-${input.nonce}`,
      license_file_url: `licenses/integration/${input.nonce}.pdf`,
      status: input.status,
      slug,
      is_specialty_approved: input.is_specialty_approved,
      subscription_tier: "standard",
    })
    .select("id")
    .single();

  if (doctorInsert.error || !doctorInsert.data?.id) {
    await input.admin.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed creating doctor: ${doctorInsert.error?.message}`);
  }

  const doctorId = String(doctorInsert.data.id);
  const specialtyUpsert = await input.admin.from("doctor_specialties").upsert(
    {
      doctor_id: doctorId,
      specialty: input.specialty,
      license_number: `LIC-${input.nonce}`,
      is_approved: input.is_specialty_approved,
    },
    { onConflict: "doctor_id,specialty" },
  );
  if (specialtyUpsert.error) {
    await input.admin.from("doctors").delete().eq("id", doctorId);
    await input.admin.auth.admin.deleteUser(authUserId);
    throw new Error(
      `Failed creating doctor_specialties: ${specialtyUpsert.error.message}`,
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

export async function deleteTestDoctor(fixture: TestDoctorFixture): Promise<void> {
  const { admin, doctorId, authUserId } = fixture;
  if (doctorId) {
    await admin.from("doctor_specialties").delete().eq("doctor_id", doctorId);
    await admin.from("doctor_services").delete().eq("doctor_id", doctorId);
    await admin.from("doctor_settings").delete().eq("doctor_id", doctorId);
    await admin.from("doctors").delete().eq("id", doctorId);
  }
  if (authUserId) {
    await admin.auth.admin.deleteUser(authUserId);
  }
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
