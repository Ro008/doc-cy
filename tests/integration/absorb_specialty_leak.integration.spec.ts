import { expect, test } from "@playwright/test";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";

/**
 * Regression test for a bug found manually (2026-09-14): verifying an
 * Unclaimed registration and absorbing a manually-pasted unregistered
 * listing URL leaked the *unregistered* listing's specialty onto the
 * *registered* doctor's public `professionals.specialties` array — even
 * though the doctor never submitted or got license-approved for it.
 *
 * `professionals.specialties` drives the public finder card + profile
 * badges directly (see lib/doctor-specialties.ts publicSpecialtyLabels).
 * `professional_specialties` (license-backed, is_approved) is the only source
 * that should ever expand it, via sync_professional_specialties_to_professional.
 * absorb_unregistered_into_registered must never touch it.
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
      // (Biochemistry) — mirrors what /register writes: professional_specialties
      // row + synced professionals.specialty/specialties.
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
      // specialty (Gynecology) — the founder pastes its URL to absorb it
      // (e.g. thinking it's a stray duplicate of the same person/clinic).
      const unregisteredInsert = await admin
        .from("professionals")
        .insert({
          name: `Absorb Leak Target ${nonce}`,
          specialty: "Gynecology",
          specialties: ["Gynecology"],
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

      // 3) Absorb (same RPC used by Verify + manual URL, Verify + card-link
      // claim_listing_id, and the internal duplicate-merge tools).
      const { error: absorbErr } = await admin.rpc("absorb_unregistered_into_registered", {
        p_registered_id: registeredId,
        p_unregistered_id: unregisteredId,
      });
      if (absorbErr) throw new Error(`absorb rpc: ${absorbErr.message}`);

      // 4) The registered doctor's public specialty data must be EXACTLY
      // what they submitted — no leak from the absorbed listing.
      const { data: afterAbsorb, error: afterErr } = await admin
        .from("professionals")
        .select("specialty, specialties")
        .eq("id", registeredId)
        .single();
      if (afterErr) throw new Error(afterErr.message);
      expect(afterAbsorb?.specialty).toBe("Biochemistry");
      expect(afterAbsorb?.specialties).toEqual(["Biochemistry"]);

      // professional_specialties (the license-backed source of truth) must also be
      // untouched — absorb never writes to it.
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
