import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { zonedTimeToUtc } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { seedProfessionalSpecialty } from "./helpers/test-doctor";

/**
 * Registration redesign, step 1: a professional exists only through their clinics.
 *
 * Approving a registration creates the professional, a clinic and a
 * professional_clinics row, and nothing else: none of the location copies on
 * `professionals` (district, town, clinic_address, latitude,
 * longitude), which Point E removes. This spec seeds exactly that shape and checks the
 * public profile, the finder and a booking all work from the clinic alone.
 *
 * Before this change the profile read its district from `professionals.district`, and
 * appointments.location_id referenced doctor_locations, so booking at such a clinic
 * failed the foreign key.
 */

type Created = {
  professionalId: string;
  authUserId: string;
  clinicId: string;
  appointmentIds: string[];
};

type Seeded = { professionalId: string; slug: string; name: string; joinId: string };

function nextWeekdayDateKey(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function seedClinicOnlyProfessional(
  admin: SupabaseClient,
  nonce: string,
  created: Created,
): Promise<Seeded> {
  const email = `clinic-only-${nonce}@integration.test`;
  const slug = `clinic-only-${nonce}`;
  const name = `Clinic Only ${nonce}`;

  const auth = await admin.auth.admin.createUser({
    email,
    password: "StrongPass123!",
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (auth.error || !auth.data.user?.id) throw new Error(`auth user: ${auth.error?.message}`);
  created.authUserId = auth.data.user.id;

  // No district, town, clinic_address or coordinates: the clinic is the only source.
  const insert = await admin
    .from("professionals")
    .insert({
      auth_user_id: auth.data.user.id,
      name,
      registration_email: email,
      email,
      mobile_number: "+35799123456",
      languages: ["English"],
      status: "verified",
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
  created.professionalId = professionalId;

  await seedProfessionalSpecialty(admin, professionalId, {
    specialty: "Dentistry",
    licenseNumber: `LIC-CO-${nonce}`,
    isApproved: true,
  });

  const clinic = await admin
    .from("clinics")
    .insert({
      name: `Clinic Only Practice ${nonce}`,
      slug: `clinic-only-practice-${nonce}`,
      district: "Paphos",
      town: "Geroskipou",
      address: `${nonce} Clinic Only Street, Geroskipou, Cyprus`,
      latitude: 34.7602,
      longitude: 32.4506,
      is_archived: false,
    })
    .select("id")
    .single();
  if (clinic.error || !clinic.data?.id) throw new Error(`clinic: ${clinic.error?.message}`);
  created.clinicId = String(clinic.data.id);

  const join = await admin
    .from("professional_clinics")
    .insert({
      professional_id: professionalId,
      clinic_id: created.clinicId,
      is_primary: true,
      sort_order: 0,
      pause_online_bookings: false,
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
    })
    .select("id")
    .single();
  if (join.error || !join.data?.id) throw new Error(`join row: ${join.error?.message}`);

  return { professionalId, slug, name, joinId: String(join.data.id) };
}

async function cleanup(admin: SupabaseClient, created: Created) {
  if (created.appointmentIds.length) {
    await admin.from("appointments").delete().in("id", created.appointmentIds);
  }
  if (created.professionalId) {
    await admin.from("appointments").delete().eq("doctor_id", created.professionalId);
    await admin.from("professional_specialties").delete().eq("professional_id", created.professionalId);
    await admin.from("professional_settings").delete().eq("professional_id", created.professionalId);
    await admin.from("professionals").delete().eq("id", created.professionalId);
  }
  if (created.clinicId) await admin.from("clinics").delete().eq("id", created.clinicId);
  if (created.authUserId) await admin.auth.admin.deleteUser(created.authUserId);
}

function emptyCreated(): Created {
  return { professionalId: "", authUserId: "", clinicId: "", appointmentIds: [] };
}

test.describe(
  "Integration: a professional's location comes from their clinics",
  { tag: ["@pr-e2e", "@pr-e2e-booking"] },
  () => {
    test("the public profile takes its district and address from the clinic", async ({ page }) => {
      test.setTimeout(120_000);
      const admin = createIntegrationAdmin(requireSafeIntegration());
      const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const created = emptyCreated();

      try {
        const seeded = await seedClinicOnlyProfessional(admin, nonce, created);

        await page.goto(`/en/${seeded.slug}`);

        await expect(page.getByText(`${nonce} Clinic Only Street`).first()).toBeVisible({
          timeout: 20_000,
        });
        // The SEO title names the district ("… in Paphos"); it came from the
        // professionals copy, which this professional doesn't have.
        await expect(page).toHaveTitle(/Paphos/, { timeout: 20_000 });
        const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
        expect(jsonLd.join("\n")).toContain('"addressRegion":"Paphos"');
      } finally {
        await cleanup(admin, created);
      }
    });

    test("the finder lists them in their clinic's district", async ({ page }) => {
      test.setTimeout(120_000);
      const admin = createIntegrationAdmin(requireSafeIntegration());
      const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const created = emptyCreated();

      try {
        const seeded = await seedClinicOnlyProfessional(admin, nonce, created);

        await page.goto(`/paphos/dentist?name=${encodeURIComponent(seeded.name)}`);
        const card = page
          .locator("section.mt-6 article")
          .filter({ has: page.getByText(seeded.name, { exact: true }) })
          .first();
        await expect(card).toBeVisible({ timeout: 20_000 });
      } finally {
        await cleanup(admin, created);
      }
    });

    test("a patient can book at the clinic, and the appointment points at the clinic link", async ({
      request,
    }) => {
      test.setTimeout(120_000);
      const admin = createIntegrationAdmin(requireSafeIntegration());
      const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const created = emptyCreated();

      try {
        const seeded = await seedClinicOnlyProfessional(admin, nonce, created);

        const local = `${nextWeekdayDateKey(2)}T11:00`;
        const res = await request.post("/api/appointments", {
          data: {
            doctorId: seeded.professionalId,
            locationId: seeded.joinId,
            patientName: `Clinic Only Patient ${nonce}`,
            patientEmail: `clinic-only-patient-${nonce}@integration.test`,
            patientPhone: "99123456",
            appointmentLocal: local,
            isNewPatient: true,
            reason: "Integration: booking at a clinic-only professional.",
          },
        });
        const body = await res.text();
        expect(res.status(), body).toBe(201);

        const json = JSON.parse(body);
        const appointmentId = String(json?.appointment?.id ?? "");
        expect(appointmentId).not.toBe("");
        created.appointmentIds.push(appointmentId);

        const row = await admin
          .from("appointments")
          .select("location_id, appointment_datetime")
          .eq("id", appointmentId)
          .single();
        expect(row.error).toBeNull();
        expect(row.data?.location_id).toBe(seeded.joinId);
        expect(new Date(String(row.data?.appointment_datetime)).toISOString()).toBe(
          zonedTimeToUtc(local, CY_TZ).toISOString(),
        );
      } finally {
        await cleanup(admin, created);
      }
    });

    test("location copies on professionals are not a clinic", async () => {
      // A district and a blank address on `professionals` (the copies Point E removes) give
      // no clinic: since D4 the loaders read clinic links only.
      test.setTimeout(60_000);
      const admin = createIntegrationAdmin(requireSafeIntegration());
      const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const created = emptyCreated();

      try {
        const email = `blank-address-${nonce}@integration.test`;
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
            name: `Blank Address ${nonce}`,
            district: "Limassol",
            clinic_address: "",
            registration_email: email,
            email,
            status: "verified",
            slug: `blank-address-${nonce}`,
            is_registered: true,
            pro_access_until: new Date(Date.now() + 180 * 86_400_000).toISOString(),
            is_archived: false,
            is_test_profile: true,
            subscription_tier: "standard",
          })
          .select("id")
          .single();
        if (insert.error || !insert.data?.id) throw new Error(`professional: ${insert.error?.message}`);
        created.professionalId = String(insert.data.id);

        const loaded = await loadDoctorLocations(created.professionalId);
        expect(loaded).toEqual([]);
      } finally {
        await cleanup(admin, created);
      }
    });

    test("a professional with no clinic takes no bookings", async ({ request }) => {
      // A registered professional with no clinic link has nowhere to point an appointment
      // at. Even with account settings unpaused and with hours, a patient must be refused
      // (403) rather than booked with no clinic.
      test.setTimeout(120_000);
      const admin = createIntegrationAdmin(requireSafeIntegration());
      const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const created = emptyCreated();

      try {
        const email = `setting-up-${nonce}@integration.test`;
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
            name: `Setting Up ${nonce}`,
            registration_email: email,
            email,
            languages: ["English"],
            status: "verified",
            slug: `setting-up-${nonce}`,
            is_registered: true,
            pro_access_until: new Date(Date.now() + 180 * 86_400_000).toISOString(),
            is_archived: false,
            is_test_profile: true,
            subscription_tier: "standard",
          })
          .select("id")
          .single();
        if (insert.error || !insert.data?.id) throw new Error(`professional: ${insert.error?.message}`);
        created.professionalId = String(insert.data.id);

        // Registering created paused account settings; open them, with weekday hours.
        const open = await admin
          .from("professional_settings")
          .update({
            pause_online_bookings: false,
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            start_time: "09:00:00",
            end_time: "17:00:00",
          })
          .eq("professional_id", created.professionalId)
          .select("professional_id");
        if (open.error || open.data?.length !== 1) throw new Error(`open settings: ${open.error?.message}`);

        const res = await request.post("/api/appointments", {
          data: {
            doctorId: created.professionalId,
            patientName: `Setting Up Patient ${nonce}`,
            patientEmail: `setting-up-patient-${nonce}@integration.test`,
            patientPhone: "99123456",
            appointmentLocal: `${nextWeekdayDateKey(2)}T11:00`,
            isNewPatient: true,
            reason: "Integration: clinic without an address.",
          },
        });
        const body = await res.text();
        expect(res.status(), body).toBe(403);

        const left = await admin
          .from("appointments")
          .select("id")
          .eq("doctor_id", created.professionalId);
        expect(left.data ?? []).toHaveLength(0);
      } finally {
        await cleanup(admin, created);
      }
    });
  },
);
