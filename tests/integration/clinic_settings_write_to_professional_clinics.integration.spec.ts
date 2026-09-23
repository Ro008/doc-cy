import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "../helpers/doctorAuth";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";

/**
 * Point D3a: a professional's own settings at a clinic — hours, breaks, slot length,
 * label, bookings pause — are written to their professional_clinics row. Each
 * professional at a clinic has their own row, so two doctors at the same clinic keep
 * their own hours.
 *
 * Which clinic, and its address, stay on doctor_locations until the registration
 * redesign moves them behind admin review. So both tables are written for a while,
 * and these tests pin the rules that keep them from overwriting each other:
 * - an address edit on the location never resets settings saved on the join row;
 * - a settings edit made the old way (on the location) still reaches the join row;
 * - account settings (professional_settings) follow the PRIMARY clinic's join row,
 *   and an address edit never resets them either;
 * - the routes write settings to the join row, and fall back to the location only for
 *   a clinic still being set up (no address yet, so no join row).
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
      district: "Paphos",
      registration_email: email,
      email,
      phone: "+35799123456",
      mobile_number: "+35799123456",
      languages: ["English"],
      status: "verified",
      slug: `d3a-${tag}-${n}`,
      is_registered: true,
      has_online_booking: true,
      finder_visible: false,
      is_archived: false,
      is_test_profile: true,
      subscription_tier: "standard",
      trial_notice_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insert.error || !insert.data?.id) throw new Error(`professional: ${insert.error?.message}`);
  const professionalId = String(insert.data.id);

  // Registering created an addressless primary location; give it an address so the
  // mirror creates its join row (and clinic).
  const primary = await admin
    .from("doctor_locations")
    .update({
      clinic_address: `D3a Street ${n}, Paphos, Cyprus`,
      district: "Paphos",
      town: "Paphos",
      latitude: 34.77,
      longitude: 32.42,
      clinic_place_id: `d3a-place-${n}`,
    })
    .eq("doctor_id", professionalId)
    .eq("is_primary", true)
    .select("id")
    .single();
  if (primary.error || !primary.data?.id) throw new Error(`primary: ${primary.error?.message}`);

  return {
    professionalId,
    authUserId: auth.data.user.id,
    email,
    password: PASSWORD,
    primaryId: String(primary.data.id),
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

async function location(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from("doctor_locations")
    .select("id, slot_duration_minutes, pause_online_bookings, label, clinic_address")
    .eq("id", id)
    .single();
  if (error) throw new Error(`location: ${error.message}`);
  return data;
}

async function accountSettings(admin: SupabaseClient, professionalId: string) {
  const { data, error } = await admin
    .from("professional_settings")
    .select("slot_duration_minutes, pause_online_bookings")
    .eq("professional_id", professionalId)
    .single();
  if (error) throw new Error(`settings: ${error.message}`);
  return data;
}

async function signIn(page: Page, seeded: Seeded) {
  await signInDoctorAndSetCookies(page, undefined, {
    email: seeded.email,
    password: seeded.password,
  });
}

test.describe("Integration: per-clinic settings live on professional_clinics", { tag: "@pr-e2e" }, () => {
  test("an address edit on the location keeps the settings saved on the join row", async () => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    let seeded: Partial<Seeded> = {};
    try {
      seeded = await seed(admin, "addr-keeps");
      const id = seeded.primaryId!;

      // The new write path: settings go straight to the join row.
      const save = await admin
        .from("professional_clinics")
        .update({ slot_duration_minutes: 45, label: "Mornings" })
        .eq("id", id);
      if (save.error) throw new Error(save.error.message);

      // An address-only edit on the location must not copy its (older) settings over.
      const move = await admin
        .from("doctor_locations")
        .update({ clinic_address: "Moved Street 2, Paphos, Cyprus" })
        .eq("id", id);
      if (move.error) throw new Error(move.error.message);

      expect(await joinRow(admin, id)).toMatchObject({ slot_duration_minutes: 45, label: "Mornings" });
    } finally {
      await cleanup(admin, seeded);
    }
  });

  test("a settings edit made the old way still reaches the join row", async () => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    let seeded: Partial<Seeded> = {};
    try {
      seeded = await seed(admin, "old-path");
      const id = seeded.primaryId!;

      const old = await admin
        .from("doctor_locations")
        .update({ slot_duration_minutes: 20, label: "Old path" })
        .eq("id", id);
      if (old.error) throw new Error(old.error.message);

      expect(await joinRow(admin, id)).toMatchObject({ slot_duration_minutes: 20, label: "Old path" });
    } finally {
      await cleanup(admin, seeded);
    }
  });

  test("account settings follow the primary clinic's join row, and survive an address edit", async () => {
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

      expect(await accountSettings(admin, seeded.professionalId!)).toEqual({
        slot_duration_minutes: 50,
        pause_online_bookings: false,
      });

      // The location still holds its older values; an address edit must not copy them in.
      const move = await admin
        .from("doctor_locations")
        .update({ clinic_address: "Account Moved 3, Paphos, Cyprus" })
        .eq("id", id);
      if (move.error) throw new Error(move.error.message);

      expect(await accountSettings(admin, seeded.professionalId!)).toEqual({
        slot_duration_minutes: 50,
        pause_online_bookings: false,
      });

      // A secondary clinic's settings are its own and never become the account's.
      const secondary = await admin
        .from("doctor_locations")
        .insert({
          doctor_id: seeded.professionalId,
          is_primary: false,
          sort_order: 1,
          clinic_address: `Secondary ${nonce()}, Limassol, Cyprus`,
          district: "Limassol",
        })
        .select("id")
        .single();
      if (secondary.error || !secondary.data) throw new Error(`secondary: ${secondary.error?.message}`);
      const secondarySave = await admin
        .from("professional_clinics")
        .update({ slot_duration_minutes: 15 })
        .eq("id", secondary.data.id);
      if (secondarySave.error) throw new Error(secondarySave.error.message);

      expect((await accountSettings(admin, seeded.professionalId!)).slot_duration_minutes).toBe(50);
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
      // Clinics start paused; the location and its join row agree on that.
      expect((await location(admin, id)).pause_online_bookings).toBe(true);

      await signIn(page, seeded as Seeded);
      const res = await page.request.post("/api/doctor-online-bookings", {
        data: { locationId: id, pauseOnlineBookings: false },
        timeout: 30_000,
      });
      expect(res.status(), await res.text()).toBe(200);

      expect((await joinRow(admin, id))?.pause_online_bookings).toBe(false);
      // The write moved: the location row is no longer where this setting is saved.
      expect((await location(admin, id)).pause_online_bookings).toBe(true);
    } finally {
      await cleanup(admin, seeded);
    }
  });

  test("editing a clinic writes its hours to the join row", async ({ page }) => {
    test.setTimeout(90_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    let seeded: Partial<Seeded> = {};
    try {
      seeded = await seed(admin, "patch");
      const id = seeded.primaryId!;
      const before = await location(admin, id);

      await signIn(page, seeded as Seeded);
      const res = await page.request.patch("/api/doctor-locations", {
        data: {
          doctorId: seeded.professionalId,
          locationId: id,
          clinicAddress: before.clinic_address,
          clinicLatitude: 34.77,
          clinicLongitude: 32.42,
          clinicPlaceId: "d3a-patch-place",
          district: "Paphos",
          town: "Paphos",
          label: "Afternoons",
          weeklySchedule: {
            monday: { enabled: true, start_time: "14:00", end_time: "18:00" },
            tuesday: { enabled: false, start_time: "09:00", end_time: "17:00" },
            wednesday: { enabled: false, start_time: "09:00", end_time: "17:00" },
            thursday: { enabled: false, start_time: "09:00", end_time: "17:00" },
            friday: { enabled: false, start_time: "09:00", end_time: "17:00" },
            saturday: { enabled: false, start_time: "09:00", end_time: "17:00" },
            sunday: { enabled: false, start_time: "09:00", end_time: "17:00" },
          },
          slotDurationMinutes: 50,
        },
        timeout: 30_000,
      });
      expect(res.status(), await res.text()).toBe(200);
      const body = (await res.json()) as { location?: { slot_duration_minutes?: number; label?: string } };
      expect(body.location).toMatchObject({ slot_duration_minutes: 50, label: "Afternoons" });

      expect(await joinRow(admin, id)).toMatchObject({ slot_duration_minutes: 50, label: "Afternoons" });
      // The location keeps its address, but no longer holds the settings.
      expect((await location(admin, id)).slot_duration_minutes).toBe(before.slot_duration_minutes);
    } finally {
      await cleanup(admin, seeded);
    }
  });

  test("a clinic still being set up keeps its hours until it has an address", async ({ page }) => {
    test.setTimeout(90_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    let seeded: Partial<Seeded> = {};
    try {
      seeded = await seed(admin, "pending");
      // Exactly what "Add clinic" creates: no address, no district, so no join row.
      const added = await admin
        .from("doctor_locations")
        .insert({ doctor_id: seeded.professionalId, is_primary: false, sort_order: 1 })
        .select("id")
        .single();
      if (added.error || !added.data) throw new Error(`added: ${added.error?.message}`);
      const id = String(added.data.id);
      expect(await joinRow(admin, id)).toBeNull();

      await signIn(page, seeded as Seeded);
      const res = await page.request.patch("/api/doctor-locations", {
        data: {
          doctorId: seeded.professionalId,
          locationId: id,
          clinicAddress: "",
          district: "",
          slotDurationMinutes: 40,
        },
        timeout: 30_000,
      });
      expect(res.status(), await res.text()).toBe(200);

      expect((await location(admin, id)).slot_duration_minutes).toBe(40);

      // Once it gets an address, its join row starts from those hours.
      const addressed = await admin
        .from("doctor_locations")
        .update({ clinic_address: `Pending Street ${nonce()}, Paphos, Cyprus`, district: "Paphos" })
        .eq("id", id);
      if (addressed.error) throw new Error(addressed.error.message);
      expect((await joinRow(admin, id))?.slot_duration_minutes).toBe(40);
    } finally {
      await cleanup(admin, seeded);
    }
  });
});
