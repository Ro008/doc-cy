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
      languages: ["English"],
      slug,
      subscription_tier: input.subscription_tier ?? "standard",
      trial_notice_seen_at:
        input.markTrialNoticeSeen === false ? null : new Date().toISOString(),
      is_registered: true,
      pro_access_until: new Date(Date.now() + 180 * 86_400_000).toISOString(),
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
  input: { specialty: string; licenseNumber?: string | null },
): Promise<void> {
  const { error } = await admin.from("professional_specialties").insert({
    professional_id: professionalId,
    specialty: input.specialty,
    license_number: input.licenseNumber ?? null,
  });
  if (error) throw new Error(`Failed creating professional_specialties: ${error.message}`);
}

/**
 * Gives a registered test professional an open primary clinic (Nicosia, weekday hours),
 * as an approved registration has: see `seedProfessionalClinic`. Registering no longer
 * creates any location (D4 dropped `doctor_locations`).
 *
 * Returns the clinic link id and the clinic id: pass the clinic id to
 * `deleteTestClinics` after deleting the professional (a removed clinic link keeps its
 * clinic).
 */
export async function openPrimaryClinicForBookings(
  admin: SupabaseClient,
  professionalId: string,
  nonce: string,
): Promise<{ locationId: string; clinicId: string }> {
  const seeded = await seedProfessionalClinic(admin, professionalId, { nonce, district: "Nicosia" });
  return { locationId: seeded.linkId, clinicId: seeded.clinicId };
}

type SeedDistrict = "Nicosia" | "Limassol" | "Paphos" | "Larnaca" | "Famagusta";

const DISTRICT_PIN: Record<SeedDistrict, { latitude: number; longitude: number }> = {
  Nicosia: { latitude: 35.1725, longitude: 33.365 },
  Limassol: { latitude: 34.6841, longitude: 33.0379 },
  Paphos: { latitude: 34.7754, longitude: 32.4245 },
  Larnaca: { latitude: 34.9229, longitude: 33.6233 },
  Famagusta: { latitude: 35.0393, longitude: 33.9832 },
};

const WEEKDAY_HOURS = { enabled: true, start_time: "09:00:00", end_time: "17:00:00" };
const DAY_OFF = { enabled: false, start_time: "09:00:00", end_time: "17:00:00" };

/**
 * Gives a seeded professional a clinic the way the registration approval does: a
 * `clinics` row and the professional's primary `professional_clinics` link, with
 * weekday hours. Every professional has a clinic (user, 2026-09-29), and since D4 the
 * finder, profiles and bookings read clinics only, so a professional without one has
 * no district and no availability.
 *
 * Delete the professional first (the link cascades), then the clinic with
 * `deleteTestClinics`.
 */
export async function seedProfessionalClinic(
  admin: SupabaseClient,
  professionalId: string,
  input: { nonce: string; district: SeedDistrict; open?: boolean },
): Promise<{ clinicId: string; linkId: string }> {
  const token = `${input.nonce}-${Math.floor(Math.random() * 1_000_000)}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const clinic = await admin
    .from("clinics")
    .insert({
      name: `Integration Clinic ${token}`,
      slug: `integration-clinic-${token}`,
      district: input.district,
      town: input.district,
      address: `${token} Integration Street, ${input.district}, Cyprus`,
      phone: "22123456",
      ...DISTRICT_PIN[input.district],
    })
    .select("id")
    .single();
  if (clinic.error || !clinic.data?.id) throw new Error(`seed clinic: ${clinic.error?.message}`);
  const clinicId = String(clinic.data.id);

  const link = await admin
    .from("professional_clinics")
    .insert({
      professional_id: professionalId,
      clinic_id: clinicId,
      is_primary: true,
      sort_order: 0,
      pause_online_bookings: input.open === false,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      start_time: "09:00:00",
      end_time: "17:00:00",
      weekly_schedule: {
        monday: WEEKDAY_HOURS,
        tuesday: WEEKDAY_HOURS,
        wednesday: WEEKDAY_HOURS,
        thursday: WEEKDAY_HOURS,
        friday: WEEKDAY_HOURS,
        saturday: DAY_OFF,
        sunday: DAY_OFF,
      },
      slot_duration_minutes: 30,
    })
    .select("id")
    .single();
  if (link.error || !link.data?.id) {
    await admin.from("clinics").delete().eq("id", clinicId);
    throw new Error(`seed clinic link: ${link.error?.message}`);
  }
  return { clinicId, linkId: String(link.data.id) };
}

export async function deleteTestClinics(
  admin: SupabaseClient,
  clinicIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(clinicIds.filter(Boolean))];
  if (ids.length) await admin.from("clinics").delete().in("id", ids);
}

export async function deleteTestDoctor(fixture: TestDoctorFixture): Promise<void> {
  const { admin, doctorId, authUserId } = fixture;
  if (doctorId) {
    // Appointments are never deleted with a professional (FK RESTRICT from M2): a test
    // professional's visits go first, with their reviews and drafts (links cascade).
    await admin.from("professional_reviews").delete().eq("professional_id", doctorId);
    await admin.from("appointment_drafts").delete().eq("professional_id", doctorId);
    await admin.from("appointments").delete().eq("professional_id", doctorId);
    await admin.from("professional_specialties").delete().eq("professional_id", doctorId);
    await admin.from("professional_services").delete().eq("professional_id", doctorId);
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
 * After the password on /login, a professional gets "Check your email" and signs in
 * with the emailed link (user, 2026-09-29). Locally no email goes out, so this asks
 * Supabase for a fresh link for the same login (it replaces the emailed one) and opens
 * it with the login page's `next`, as clicking the email would.
 */
export async function finishEmailedSignIn(
  page: Page,
  admin: SupabaseClient,
  email: string,
): Promise<void> {
  await expect(page.getByRole("heading", { name: /Check your email/i })).toBeVisible({
    timeout: 20_000,
  });
  const next = new URL(page.url()).searchParams.get("next");
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw new Error(`sign-in link: ${error?.message ?? "no token"}`);
  const params = new URLSearchParams({ token_hash: tokenHash });
  if (next) params.set("next", next);
  await page.goto(`/auth/sign-in-link?${params.toString()}`);
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
