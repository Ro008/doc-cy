import { expect, test } from "@playwright/test";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { seedProfessionalSpecialty } from "./helpers/test-doctor";

/**
 * Regression test for a bug found manually (2026-09-14): verifying an
 * Unclaimed registration and absorbing a manually-pasted unregistered
 * listing URL leaked the *unregistered* listing's specialty onto the
 * *registered* doctor's public specialties — even though the doctor never
 * submitted or got license-approved for it.
 *
 * A professional's specialties are its `professional_specialties` rows
 * (license-backed, is_approved); they drive the finder card and profile badges.
 * absorb_unregistered_into_registered must never add to them.
 */
test.describe("Integration: absorb must not leak specialties", { tag: "@pr-e2e" }, () => {
  test("absorb_unregistered_into_registered never adds specialties to the registered row", async () => {
    const env = requireSafeIntegration();
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    let authRegistered = "";
    let registeredId = "";
    let unregisteredId = "";

    try {
      // 1) A doctor registers with exactly one license-backed specialty
      // (Biochemistry) — mirrors what /register writes: a professional_specialties
      // row.
      const createUser = await admin.auth.admin.createUser({
        email: `absorb-leak-${nonce}@integration.test`,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createUser.error || !createUser.data.user?.id) {
        throw new Error(`registered auth: ${createUser.error?.message}`);
      }
      authRegistered = createUser.data.user.id;

      const registeredInsert = await admin
        .from("professionals")
        .insert({
          auth_user_id: authRegistered,
          name: `Absorb Leak Doctor ${nonce}`,
          district: "Nicosia",
          registration_email: `absorb-leak-${nonce}@integration.test`,
          mobile_number: "+35799112233",
          languages: ["English"],
          status: "verified",
          slug: `absorb-leak-doctor-${nonce}`,
          is_registered: true,
          has_online_booking: true,
          finder_visible: true,
          is_archived: false,
          is_test_profile: true,
          subscription_tier: "standard",
        })
        .select("id")
        .single();
      if (registeredInsert.error || !registeredInsert.data?.id) {
        throw new Error(`registered insert: ${registeredInsert.error?.message}`);
      }
      registeredId = String(registeredInsert.data.id);

      const specialtyInsert = await admin.from("professional_specialties").insert({
        professional_id: registeredId,
        specialty: "Biochemistry",
        license_number: `LIC-LEAK-${nonce}`,
        is_approved: true,
      });
      if (specialtyInsert.error) {
        throw new Error(`professional_specialties insert: ${specialtyInsert.error.message}`);
      }

      // 2) An unrelated unregistered finder listing with a DIFFERENT
      // specialty (Dermatology) — the founder pastes its URL to absorb it
      // (e.g. thinking it's a stray duplicate of the same person/clinic).
      const unregisteredInsert = await admin
        .from("professionals")
        .insert({
          name: `Absorb Leak Target ${nonce}`,
          district: "Nicosia",
          slug: `absorb-leak-target-${nonce}`,
          address_maps_link: "https://maps.google.com/?q=absorb-leak-target",
          is_registered: false,
          has_online_booking: false,
          finder_visible: true,
          is_archived: false,
          is_test_profile: true,
        })
        .select("id")
        .single();
      if (unregisteredInsert.error || !unregisteredInsert.data?.id) {
        throw new Error(`unregistered insert: ${unregisteredInsert.error?.message}`);
      }
      unregisteredId = String(unregisteredInsert.data.id);
      await seedProfessionalSpecialty(admin, unregisteredId, { specialty: "Dermatology" });

      // 3) Absorb (same RPC used by Verify + manual URL, Verify + card-link
      // claim_listing_id, and the internal duplicate-merge tools).
      const { error: absorbErr } = await admin.rpc("absorb_unregistered_into_registered", {
        p_registered_id: registeredId,
        p_unregistered_id: unregisteredId,
      });
      if (absorbErr) throw new Error(`absorb rpc: ${absorbErr.message}`);

      // 4) The registered doctor's specialties must be EXACTLY what they
      // submitted — no leak from the absorbed listing.
      const { data: specRows, error: specErr } = await admin
        .from("professional_specialties")
        .select("specialty, is_approved")
        .eq("professional_id", registeredId);
      if (specErr) throw new Error(specErr.message);
      expect(specRows).toHaveLength(1);
      expect(specRows?.[0]?.specialty).toBe("Biochemistry");

      // The absorbed listing is archived (merge still works for everything
      // else: clinics, address, slug redirect, etc.) — just not specialties.
      const { data: archivedTarget, error: archivedErr } = await admin
        .from("professionals")
        .select("is_archived")
        .eq("id", unregisteredId)
        .single();
      if (archivedErr) throw new Error(archivedErr.message);
      expect(archivedTarget?.is_archived).toBe(true);
    } finally {
      for (const id of [registeredId, unregisteredId].filter(Boolean)) {
        await admin.from("professional_specialties").delete().eq("professional_id", id);
        await admin.from("professional_slug_redirects").delete().eq("professional_id", id);
        await admin.from("professionals").delete().eq("id", id);
      }
      if (authRegistered) await admin.auth.admin.deleteUser(authRegistered);
    }
  });
});
