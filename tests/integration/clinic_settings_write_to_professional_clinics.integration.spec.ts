import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "../helpers/doctorAuth";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { seedProfessionalClinic } from "./helpers/test-doctor";

/**
 * Point D3a: a professional's own settings at a clinic — hours, breaks, slot length,
 * label, bookings pause — are written to their professional_clinics row. Each
 * professional at a clinic has their own row, so two doctors at the same clinic keep
 * their own hours.
 *
 * Rules pinned here:
 * - each clinic's settings stay on its own join row (since Point E6 professional_settings
 *   keeps no copy of the primary clinic's schedule);
 * - the bookings toggle writes the clinic's join row (the settings save is covered by
 *   settings_clinics_read_only).
 */

type Seeded = {
  professionalId: string;
  authUserId: string;
  email: string;
  password: string;
  primaryId: string;
};

const PASSWORD = "StrongPass123!";

function nonce(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function seed(admin: SupabaseClient, tag: string): Promise<Seeded> {
  const n = nonce();
  const email = `d3a-${tag}-${n}@integration.test`;
  const auth = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (auth.error || !auth.data.user?.id) throw new Error(`auth user: ${auth.error?.message}`);

  const insert = await admin
    .from("professionals")
    .insert({
      auth_user_id: auth.data.user.id,
      name: `D3a ${tag} ${n}`,
      registration_email: email,
      email,
      mobile_number: "+35799123456",
      languages: ["English"],
      status: "verified",
      slug: `d3a-${tag}-${n}`,
      is_registered: true,
      pro_access_until: new Date(Date.now() + 180 * 86_400_000).toISOString(),
      is_archived: false,
      is_test_profile: true,
      subscription_tier: "standard",
      trial_notice_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insert.error || !insert.data?.id) throw new Error(`professional: ${insert.error?.message}`);
  const professionalId = String(insert.data.id);

  // A paused primary clinic, as an approved registration leaves it.
  const primary = await seedProfessionalClinic(admin, professionalId, {
    nonce: `d3a-${tag}-${n}`,
    district: "Paphos",
    open: false,
  });

  return {
    professionalId,
    authUserId: auth.data.user.id,
    email,
    password: PASSWORD,
    primaryId: primary.linkId,
  };
}

async function cleanup(admin: SupabaseClient, seeded: Partial<Seeded>) {
  if (seeded.professionalId) {
    const { data } = await admin
      .from("professional_clinics")
      .select("clinic_id")
      .eq("professional_id", seeded.professionalId);
    const clinicIds = [...new Set((data ?? []).map((row) => String(row.clinic_id)))];
    await admin.from("professionals").delete().eq("id", seeded.professionalId);
    if (clinicIds.length) await admin.from("clinics").delete().in("id", clinicIds);
  }
  if (seeded.authUserId) await admin.auth.admin.deleteUser(seeded.authUserId);
}

async function joinRow(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from("professional_clinics")
    .select("id, slot_duration_minutes, pause_online_bookings, label, start_time")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`join row: ${error.message}`);
  return data;
}

async function signIn(page: Page, seeded: Seeded) {
  await signInDoctorAndSetCookies(page, undefined, {
    email: seeded.email,
    password: seeded.password,
  });
}

test.describe("Integration: per-clinic settings live on professional_clinics", { tag: "@pr-e2e" }, () => {
  // Since Point E6 professional_settings holds no copy of the primary clinic's schedule:
  // each clinic's settings are its own join row's.
  test("each clinic keeps its own settings on its join row", async () => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    let seeded: Partial<Seeded> = {};
    try {
      seeded = await seed(admin, "account");
      const id = seeded.primaryId!;

      const save = await admin
        .from("professional_clinics")
        .update({ slot_duration_minutes: 50, pause_online_bookings: false })
        .eq("id", id);
      if (save.error) throw new Error(save.error.message);

      expect(await joinRow(admin, id)).toMatchObject({
        slot_duration_minutes: 50,
        pause_online_bookings: false,
      });

      // A secondary clinic's settings are its own.
      const n = nonce();
      const clinic = await admin
        .from("clinics")
        .insert({
          name: `D3a Secondary ${n}`,
          slug: `d3a-secondary-${n}`,
          district: "Limassol",
          address: `Secondary ${n}, Limassol, Cyprus`,
          phone: "25123456",
        })
        .select("id")
        .single();
      if (clinic.error || !clinic.data) throw new Error(`secondary clinic: ${clinic.error?.message}`);
      const secondary = await admin
        .from("professional_clinics")
        .insert({
          professional_id: seeded.professionalId,
          clinic_id: clinic.data.id,
          is_primary: false,
          sort_order: 1,
        })
        .select("id")
        .single();
      if (secondary.error || !secondary.data) throw new Error(`secondary: ${secondary.error?.message}`);
      const secondarySave = await admin
        .from("professional_clinics")
        .update({ slot_duration_minutes: 15 })
        .eq("id", secondary.data.id);
      if (secondarySave.error) throw new Error(secondarySave.error.message);

      expect((await joinRow(admin, String(secondary.data.id)))?.slot_duration_minutes).toBe(15);
      expect((await joinRow(admin, id))?.slot_duration_minutes).toBe(50);
    } finally {
      await cleanup(admin, seeded);
    }
  });

  test("the bookings toggle writes the clinic's join row", async ({ page }) => {
    test.setTimeout(90_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    let seeded: Partial<Seeded> = {};
    try {
      seeded = await seed(admin, "toggle");
      const id = seeded.primaryId!;
      // Clinics start paused.
      expect((await joinRow(admin, id))?.pause_online_bookings).toBe(true);

      await signIn(page, seeded as Seeded);
      const res = await page.request.post("/api/doctor-online-bookings", {
        data: { locationId: id, pauseOnlineBookings: false },
        timeout: 30_000,
      });
      expect(res.status(), await res.text()).toBe(200);

      expect((await joinRow(admin, id))?.pause_online_bookings).toBe(false);
    } finally {
      await cleanup(admin, seeded);
    }
  });
});
