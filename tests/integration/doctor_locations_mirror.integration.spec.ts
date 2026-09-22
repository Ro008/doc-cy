import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";

/**
 * Point D1: every write to doctor_locations is mirrored onto the professional_clinics
 * join row with the same id (and its clinic), so the read cutover in D2 can switch
 * tables without changing anything a patient or professional sees.
 *
 * Rules the trigger must keep:
 * - a location gets a join row whose id equals the location id;
 * - a location at the exact address of a clinic the professional is already linked to
 *   (an absorbed GeSY listing) adopts that join row instead of creating a duplicate;
 * - schedule, pause, label, primary and sort order always follow the location;
 * - a clinic created by DocCy for this location follows its address; a GeSY or shared
 *   clinic is never edited, the location moves to a new clinic of its own instead;
 * - deleting the location deletes the join row but never the clinic.
 */

type Created = { professionalIds: string[]; clinicIds: string[]; authUserIds: string[] };

const SCHEDULE_FIELDS =
  "is_primary, sort_order, label, pause_online_bookings, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, weekly_schedule, break_start, break_end, slot_duration_minutes";

function nonce(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function createProfessional(
  admin: SupabaseClient,
  created: Created,
  tag: string,
): Promise<{ id: string; name: string }> {
  const n = nonce();
  const name = `Mirror ${tag} ${n}`;
  const email = `mirror-${tag}-${n}@integration.test`;
  const auth = await admin.auth.admin.createUser({
    email,
    password: "StrongPass123!",
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (auth.error || !auth.data.user?.id) throw new Error(`auth user: ${auth.error?.message}`);
  created.authUserIds.push(auth.data.user.id);
  // No clinic_address: the create-primary-location trigger still inserts an
  // addressless primary location, which must NOT produce a join row.
  const { data, error } = await admin
    .from("professionals")
    .insert({
      auth_user_id: auth.data.user.id,
      name,
      district: "Nicosia",
      registration_email: email,
      mobile_number: "+35799112233",
      languages: ["English"],
      status: "verified",
      slug: `mirror-${tag}-${n}`,
      is_registered: true,
      has_online_booking: true,
      finder_visible: false,
      is_archived: false,
      is_test_profile: true,
      subscription_tier: "standard",
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`professional insert: ${error?.message}`);
  created.professionalIds.push(String(data.id));
  return { id: String(data.id), name };
}

async function joinRow(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from("professional_clinics")
    .select(
      `id, professional_id, clinic_id, ${SCHEDULE_FIELDS}, clinics ( id, name, slug, address, district, town, latitude, longitude, clinic_place_id, ghs_code )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`join row read: ${error.message}`);
  if (!data) return null;
  const clinic = Array.isArray(data.clinics) ? data.clinics[0] : data.clinics;
  return { ...data, clinics: clinic as Record<string, unknown> | null };
}

async function joinRowsFor(admin: SupabaseClient, professionalId: string) {
  const { data, error } = await admin
    .from("professional_clinics")
    .select("id, clinic_id")
    .eq("professional_id", professionalId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function insertLocation(
  admin: SupabaseClient,
  professionalId: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin
    .from("doctor_locations")
    .insert({ doctor_id: professionalId, is_primary: false, sort_order: 1, ...fields })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`location insert: ${error?.message}`);
  return String(data.id);
}

async function locationSchedule(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from("doctor_locations")
    .select(SCHEDULE_FIELDS)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function scheduleOf(row: Record<string, unknown>) {
  return Object.fromEntries(SCHEDULE_FIELDS.split(", ").map((key) => [key, row[key]]));
}

async function cleanup(admin: SupabaseClient, created: Created) {
  for (const id of created.professionalIds) {
    const links = await joinRowsFor(admin, id);
    created.clinicIds.push(...links.map((link) => String(link.clinic_id)));
    await admin.from("professionals").delete().eq("id", id);
  }
  const clinicIds = [...new Set(created.clinicIds)];
  if (clinicIds.length) await admin.from("clinics").delete().in("id", clinicIds);
  for (const id of created.authUserIds) await admin.auth.admin.deleteUser(id);
}

test.describe("Integration: doctor_locations mirror onto professional_clinics", { tag: "@pr-e2e" }, () => {
  test("a new location gets a join row with its id and a DocCy clinic", async () => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const created: Created = { professionalIds: [], clinicIds: [], authUserIds: [] };
    try {
      const pro = await createProfessional(admin, created, "insert");

      // The addressless primary location from the registration trigger has no clinic.
      expect(await joinRowsFor(admin, pro.id)).toHaveLength(0);

      const locationId = await insertLocation(admin, pro.id, {
        clinic_address: "Makariou Avenue 10, Nicosia 1065, Cyprus",
        district: "Nicosia",
        town: "Nicosia",
        latitude: 35.17,
        longitude: 33.36,
        clinic_place_id: `place-${nonce()}`,
        label: "Evenings",
        pause_online_bookings: false,
        saturday: true,
        start_time: "10:00:00",
        slot_duration_minutes: 45,
      });

      const row = await joinRow(admin, locationId);
      expect(row, "join row with the location id").not.toBeNull();
      expect(row!.professional_id).toBe(pro.id);
      expect(scheduleOf(row!)).toEqual(scheduleOf(await locationSchedule(admin, locationId)));
      expect(row!.clinics).toMatchObject({
        name: pro.name,
        address: "Makariou Avenue 10, Nicosia 1065, Cyprus",
        district: "Nicosia",
        town: "Nicosia",
        latitude: 35.17,
        longitude: 33.36,
        ghs_code: null,
      });
    } finally {
      await cleanup(admin, created);
    }
  });

  test("an addressless location gets its join row once it has an address", async () => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const created: Created = { professionalIds: [], clinicIds: [], authUserIds: [] };
    try {
      const pro = await createProfessional(admin, created, "late-address");
      const { data: primary, error } = await admin
        .from("doctor_locations")
        .select("id")
        .eq("doctor_id", pro.id)
        .eq("is_primary", true)
        .single();
      if (error || !primary) throw new Error(`primary location: ${error?.message}`);

      await admin
        .from("doctor_locations")
        .update({ clinic_address: "Ledra Street 5, Nicosia, Cyprus", town: "Nicosia" })
        .eq("id", primary.id);

      const row = await joinRow(admin, String(primary.id));
      expect(row).not.toBeNull();
      expect(row!.is_primary).toBe(true);
      expect(row!.clinics).toMatchObject({ address: "Ledra Street 5, Nicosia, Cyprus" });
    } finally {
      await cleanup(admin, created);
    }
  });

  test("a location at an absorbed GeSY clinic's address adopts that join row", async () => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const created: Created = { professionalIds: [], clinicIds: [], authUserIds: [] };
    try {
      const pro = await createProfessional(admin, created, "absorbed");
      const n = nonce();
      const address = "Avenue Michalaki Kyprianou 24, Pegeia, 8560, Paphos";
      const { data: gesy, error: gesyErr } = await admin
        .from("clinics")
        .insert({
          name: `GeSY Practice ${n}`,
          slug: `gesy-practice-${n}`,
          district: "Paphos",
          address,
          ghs_code: `TEST-D1-${n}`,
        })
        .select("id")
        .single();
      if (gesyErr || !gesy) throw new Error(`clinic insert: ${gesyErr?.message}`);
      created.clinicIds.push(String(gesy.id));

      // What absorb_unregistered_into_registered leaves behind: a link with its own id.
      const { data: link, error: linkErr } = await admin
        .from("professional_clinics")
        .insert({ professional_id: pro.id, clinic_id: gesy.id, is_primary: true })
        .select("id")
        .single();
      if (linkErr || !link) throw new Error(`link insert: ${linkErr?.message}`);

      // What the verify route then adds (#201), with the clinic's address copied.
      const locationId = await insertLocation(admin, pro.id, {
        clinic_address: `${address} `,
        district: "Paphos",
        town: "Pegeia",
        pause_online_bookings: true,
      });

      const links = await joinRowsFor(admin, pro.id);
      expect(links, "no duplicate clinic").toHaveLength(1);
      expect(links[0]).toEqual({ id: locationId, clinic_id: gesy.id });

      const row = await joinRow(admin, locationId);
      expect(scheduleOf(row!)).toEqual(scheduleOf(await locationSchedule(admin, locationId)));
      expect(row!.is_primary).toBe(false);
      expect(row!.clinics).toMatchObject({ name: `GeSY Practice ${n}`, address });
    } finally {
      await cleanup(admin, created);
    }
  });

  test("updates follow the location; GeSY clinics are never edited", async () => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const created: Created = { professionalIds: [], clinicIds: [], authUserIds: [] };
    try {
      const pro = await createProfessional(admin, created, "update");
      const n = nonce();

      // A location on a clinic DocCy created for it.
      const ownId = await insertLocation(admin, pro.id, {
        clinic_address: "Old Street 1, Limassol, Cyprus",
        district: "Limassol",
      });
      const ownClinicId = String((await joinRow(admin, ownId))!.clinic_id);

      await admin
        .from("doctor_locations")
        .update({
          clinic_address: "New Street 2, Limassol, Cyprus",
          town: "Limassol",
          latitude: 34.68,
          longitude: 33.04,
          label: "Mornings",
          pause_online_bookings: false,
          weekly_schedule: { monday: { enabled: true, start_time: "08:00:00", end_time: "12:00:00" } },
          slot_duration_minutes: 20,
          sort_order: 3,
        })
        .eq("id", ownId);

      const own = await joinRow(admin, ownId);
      expect(scheduleOf(own!)).toEqual(scheduleOf(await locationSchedule(admin, ownId)));
      expect(own!.clinic_id, "own clinic updated in place").toBe(ownClinicId);
      expect(own!.clinics).toMatchObject({
        address: "New Street 2, Limassol, Cyprus",
        town: "Limassol",
        latitude: 34.68,
        longitude: 33.04,
      });

      // A location that adopted a GeSY clinic, then moved.
      const gesyAddress = `Gesy Road ${n}, Larnaca, Cyprus`;
      const { data: gesy, error: gesyErr } = await admin
        .from("clinics")
        .insert({
          name: `GeSY Clinic ${n}`,
          slug: `gesy-clinic-${n}`,
          district: "Larnaca",
          address: gesyAddress,
          ghs_code: `TEST-D1U-${n}`,
        })
        .select("id")
        .single();
      if (gesyErr || !gesy) throw new Error(`clinic insert: ${gesyErr?.message}`);
      created.clinicIds.push(String(gesy.id));
      await admin.from("professional_clinics").insert({ professional_id: pro.id, clinic_id: gesy.id });
      const gesyLocationId = await insertLocation(admin, pro.id, {
        clinic_address: gesyAddress,
        district: "Larnaca",
      });
      expect((await joinRow(admin, gesyLocationId))!.clinic_id).toBe(gesy.id);

      await admin
        .from("doctor_locations")
        .update({ clinic_address: "Elsewhere 9, Larnaca, Cyprus", pause_online_bookings: false })
        .eq("id", gesyLocationId);

      const moved = await joinRow(admin, gesyLocationId);
      expect(moved!.pause_online_bookings).toBe(false);
      expect(moved!.clinic_id, "moved to a clinic of its own").not.toBe(gesy.id);
      expect(moved!.clinics).toMatchObject({
        name: pro.name,
        address: "Elsewhere 9, Larnaca, Cyprus",
        ghs_code: null,
      });
      const { data: untouched } = await admin
        .from("clinics")
        .select("address, name")
        .eq("id", gesy.id)
        .single();
      expect(untouched).toEqual({ address: gesyAddress, name: `GeSY Clinic ${n}` });
    } finally {
      await cleanup(admin, created);
    }
  });

  test("deleting a location deletes its join row and keeps the clinic", async () => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const created: Created = { professionalIds: [], clinicIds: [], authUserIds: [] };
    try {
      const pro = await createProfessional(admin, created, "delete");
      const locationId = await insertLocation(admin, pro.id, {
        clinic_address: "Gone Street 3, Nicosia, Cyprus",
        district: "Nicosia",
      });
      const clinicId = String((await joinRow(admin, locationId))!.clinic_id);
      created.clinicIds.push(clinicId);

      const { error } = await admin.from("doctor_locations").delete().eq("id", locationId);
      if (error) throw new Error(error.message);

      expect(await joinRow(admin, locationId)).toBeNull();
      const { data: clinic } = await admin.from("clinics").select("id").eq("id", clinicId).maybeSingle();
      expect(clinic).not.toBeNull();
    } finally {
      await cleanup(admin, created);
    }
  });
});
