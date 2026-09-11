import { expect, test } from "@playwright/test";

import { classifyPendingRegistrationOrigin } from "@/lib/pending-registration-origin";
import { pickUniqueDirectoryClaim } from "@/lib/claim-directory-professional";
import {
  createIntegrationAdmin,
  requireSafeIntegration,
} from "./helpers/safe-integration";
import { postPendingRegistrationTwin } from "./helpers/internal-api";

/**
 * Critical founder flows for pending registration origin:
 * Possible twin absorb/keep both, Unclaimed, Auto-matched, Claimed.
 * Uses DB fixtures + internal API (no live /register UI).
 */
test.describe("Integration: pending registration origin actions", { tag: "@pr-e2e" }, () => {
  test("classifies twin/unclaimed/auto-match and absorb/keep_both work", async ({
    request,
  }) => {
    const env = requireSafeIntegration({ needsInternalSecret: true });
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    let authPending = "";
    let authAuto = "";
    let pendingId = "";
    let twinListingId = "";
    let keepListingId = "";
    let keepPendingId = "";
    let authKeep = "";
    let unclaimedId = "";
    let authUnclaimed = "";
    let autoListingId = "";
    let autoRegisteredId = "";
    let claimedOnlyId = "";
    let authClaimed = "";

    const twinName = `Pending Twin ${nonce}`;
    const keepName = `Keep Twin ${nonce}`;
    const unclaimedName = `Unclaimed Solo ${nonce}`;
    const autoEmail = `auto.match.${nonce}@example.com`;
    const autoName = `Auto Match ${nonce}`;

    try {
      const createPendingUser = await admin.auth.admin.createUser({
        email: `pending-twin-${nonce}@integration.test`,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createPendingUser.error || !createPendingUser.data.user?.id) {
        throw new Error(`pending auth: ${createPendingUser.error?.message}`);
      }
      authPending = createPendingUser.data.user.id;

      const createKeepUser = await admin.auth.admin.createUser({
        email: `keep-twin-${nonce}@integration.test`,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createKeepUser.error || !createKeepUser.data.user?.id) {
        throw new Error(`keep auth: ${createKeepUser.error?.message}`);
      }
      authKeep = createKeepUser.data.user.id;

      const createUnclaimedUser = await admin.auth.admin.createUser({
        email: `unclaimed-${nonce}@integration.test`,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createUnclaimedUser.error || !createUnclaimedUser.data.user?.id) {
        throw new Error(`unclaimed auth: ${createUnclaimedUser.error?.message}`);
      }
      authUnclaimed = createUnclaimedUser.data.user.id;

      const createAutoUser = await admin.auth.admin.createUser({
        email: autoEmail,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createAutoUser.error || !createAutoUser.data.user?.id) {
        throw new Error(`auto auth: ${createAutoUser.error?.message}`);
      }
      authAuto = createAutoUser.data.user.id;

      const createClaimedUser = await admin.auth.admin.createUser({
        email: `claimed-card-${nonce}@integration.test`,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createClaimedUser.error || !createClaimedUser.data.user?.id) {
        throw new Error(`claimed auth: ${createClaimedUser.error?.message}`);
      }
      authClaimed = createClaimedUser.data.user.id;

      const listings = await admin
        .from("professionals")
        .insert([
          {
            name: twinName,
            specialty: "Dentistry",
            district: "Paphos",
            slug: `pending-twin-listing-${nonce}`,
            address_maps_link: "https://maps.google.com/?q=pending-twin",
            is_registered: false,
            has_online_booking: false,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
          },
          {
            name: keepName,
            specialty: "Dentistry",
            district: "Limassol",
            slug: `keep-twin-listing-${nonce}`,
            address_maps_link: "https://maps.google.com/?q=keep-twin",
            is_registered: false,
            has_online_booking: false,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
          },
          {
            name: autoName,
            specialty: "Dentistry",
            district: "Nicosia",
            email: autoEmail,
            slug: `auto-match-listing-${nonce}`,
            address_maps_link: "https://maps.google.com/?q=auto-match",
            is_registered: false,
            has_online_booking: false,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
          },
        ])
        .select("id, name, email, specialty, district, slug");
      if (listings.error || !listings.data || listings.data.length !== 3) {
        throw new Error(`listings insert: ${listings.error?.message}`);
      }
      twinListingId = String(listings.data[0].id);
      keepListingId = String(listings.data[1].id);
      autoListingId = String(listings.data[2].id);

      const pendingRows = await admin
        .from("professionals")
        .insert([
          {
            auth_user_id: authPending,
            name: twinName,
            specialty: "Dentistry",
            district: "Paphos",
            registration_email: `pending-twin-${nonce}@integration.test`,
            mobile_number: "+35799111111",
            languages: ["English"],
            license_number: `LIC-TWIN-${nonce}`,
            license_file_url: `licenses/integration/${nonce}-twin.pdf`,
            status: "pending",
            slug: `pending-twin-reg-${nonce}`,
            is_specialty_approved: true,
            is_registered: true,
            has_online_booking: true,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
            subscription_tier: "standard",
            directory_claim_source: null,
          },
          {
            auth_user_id: authKeep,
            name: keepName,
            specialty: "Dentistry",
            district: "Limassol",
            registration_email: `keep-twin-${nonce}@integration.test`,
            mobile_number: "+35799222222",
            languages: ["English"],
            license_number: `LIC-KEEP-${nonce}`,
            license_file_url: `licenses/integration/${nonce}-keep.pdf`,
            status: "pending",
            slug: `keep-twin-reg-${nonce}`,
            is_specialty_approved: true,
            is_registered: true,
            has_online_booking: true,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
            subscription_tier: "standard",
            directory_claim_source: null,
          },
          {
            auth_user_id: authUnclaimed,
            name: unclaimedName,
            specialty: "Cardiology",
            district: "Larnaca",
            registration_email: `unclaimed-${nonce}@integration.test`,
            mobile_number: "+35799333333",
            languages: ["English"],
            license_number: `LIC-UNC-${nonce}`,
            license_file_url: `licenses/integration/${nonce}-unc.pdf`,
            status: "pending",
            slug: `unclaimed-reg-${nonce}`,
            is_specialty_approved: true,
            is_registered: true,
            has_online_booking: true,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
            subscription_tier: "standard",
            directory_claim_source: null,
          },
          {
            auth_user_id: authClaimed,
            name: `Card Claimed ${nonce}`,
            specialty: "Dentistry",
            district: "Paphos",
            registration_email: `claimed-card-${nonce}@integration.test`,
            mobile_number: "+35799444444",
            languages: ["English"],
            license_number: `LIC-CARD-${nonce}`,
            license_file_url: `licenses/integration/${nonce}-card.pdf`,
            status: "pending",
            slug: `card-claimed-reg-${nonce}`,
            is_specialty_approved: true,
            is_registered: true,
            has_online_booking: true,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
            subscription_tier: "standard",
            directory_claim_source: "card_link",
          },
        ])
        .select("id, name, specialty, district, directory_claim_source");
      if (pendingRows.error || !pendingRows.data || pendingRows.data.length !== 4) {
        throw new Error(`pending insert: ${pendingRows.error?.message}`);
      }
      pendingId = String(pendingRows.data[0].id);
      keepPendingId = String(pendingRows.data[1].id);
      unclaimedId = String(pendingRows.data[2].id);
      claimedOnlyId = String(pendingRows.data[3].id);

      const activeListings = [
        {
          id: twinListingId,
          name: twinName,
          specialty: "Dentistry",
          district: "Paphos",
          slug: `pending-twin-listing-${nonce}`,
        },
        {
          id: keepListingId,
          name: keepName,
          specialty: "Dentistry",
          district: "Limassol",
          slug: `keep-twin-listing-${nonce}`,
        },
        {
          id: autoListingId,
          name: autoName,
          specialty: "Dentistry",
          district: "Nicosia",
          slug: `auto-match-listing-${nonce}`,
        },
      ];

      const twinOrigin = classifyPendingRegistrationOrigin({
        claimSource: null,
        doctor: {
          doctorId: pendingId,
          name: twinName,
          specialty: "Dentistry",
          district: "Paphos",
        },
        unregisteredListings: activeListings,
      });
      expect(twinOrigin.kind).toBe("possible_twin");
      expect(twinOrigin.twins.map((t) => t.id)).toContain(twinListingId);

      const unclaimedOrigin = classifyPendingRegistrationOrigin({
        claimSource: null,
        doctor: {
          doctorId: unclaimedId,
          name: unclaimedName,
          specialty: "Cardiology",
          district: "Larnaca",
        },
        unregisteredListings: activeListings,
      });
      expect(unclaimedOrigin.kind).toBe("unclaimed_review");
      expect(unclaimedOrigin.twins).toEqual([]);

      const claimedOrigin = classifyPendingRegistrationOrigin({
        claimSource: "card_link",
        doctor: {
          doctorId: claimedOnlyId,
          name: `Card Claimed ${nonce}`,
          specialty: "Dentistry",
          district: "Paphos",
        },
        unregisteredListings: activeListings,
      });
      expect(claimedOrigin.kind).toBe("claimed_listing");
      expect(claimedOrigin.twins).toEqual([]);

      const fuzzy = pickUniqueDirectoryClaim(
        {
          name: autoName,
          email: autoEmail,
          district: "Nicosia",
          specialties: ["Dentistry"],
          isTestSignup: false,
        },
        [
          {
            id: autoListingId,
            slug: `auto-match-listing-${nonce}`,
            name: autoName,
            specialty: "Dentistry",
            district: "Nicosia",
            email: autoEmail,
          },
        ],
      );
      expect(fuzzy?.id).toBe(autoListingId);
      expect(fuzzy?.reason).toBe("email");

      const { data: autoRpc, error: autoRpcErr } = await admin.rpc(
        "register_doctor_with_founder_lock",
        {
          p_auth_user_id: authAuto,
          p_name: autoName,
          p_specialty: "Dentistry",
          p_email: autoEmail,
          p_phone: "+35799555555",
          p_languages: ["English"],
          p_license_number: `LIC-AUTO-${nonce}`,
          p_license_file_url: `licenses/integration/${nonce}-auto.pdf`,
          p_slug: `auto-match-listing-${nonce}`,
          p_is_specialty_approved: true,
          p_claim_professional_id: autoListingId,
        },
      );
      if (autoRpcErr || !autoRpc?.[0]?.doctor_id) {
        throw new Error(`auto claim RPC: ${autoRpcErr?.message ?? "missing id"}`);
      }
      autoRegisteredId = String(autoRpc[0].doctor_id);
      expect(autoRegisteredId).toBe(autoListingId);

      const { error: sourceErr } = await admin
        .from("professionals")
        .update({
          directory_claim_source: fuzzy!.reason,
          district: "Nicosia",
          status: "pending",
        })
        .eq("id", autoRegisteredId);
      if (sourceErr) throw new Error(`auto claim source: ${sourceErr.message}`);

      const { data: autoRow, error: autoRowErr } = await admin
        .from("professionals")
        .select("id, is_registered, directory_claim_source")
        .eq("id", autoRegisteredId)
        .single();
      if (autoRowErr) throw new Error(autoRowErr.message);
      expect(autoRow?.is_registered).toBe(true);
      expect(autoRow?.directory_claim_source).toBe("email");

      const autoOrigin = classifyPendingRegistrationOrigin({
        claimSource: "email",
        doctor: {
          doctorId: autoRegisteredId,
          name: autoName,
          specialty: "Dentistry",
          district: "Nicosia",
        },
        unregisteredListings: activeListings.filter((l) => l.id !== autoListingId),
      });
      expect(autoOrigin.kind).toBe("auto_matched_listing");

      const absorbRes = await postPendingRegistrationTwin(request, env.internalSecret, {
        registeredId: pendingId,
        unregisteredId: twinListingId,
        action: "absorb",
      });
      expect(absorbRes.status()).toBe(200);

      const { data: absorbedListing, error: absorbedErr } = await admin
        .from("professionals")
        .select("is_archived")
        .eq("id", twinListingId)
        .single();
      if (absorbedErr) throw new Error(absorbedErr.message);
      expect(absorbedListing?.is_archived).toBe(true);

      const afterAbsorb = classifyPendingRegistrationOrigin({
        claimSource: null,
        doctor: {
          doctorId: pendingId,
          name: twinName,
          specialty: "Dentistry",
          district: "Paphos",
        },
        unregisteredListings: activeListings.filter((l) => l.id !== twinListingId),
      });
      expect(afterAbsorb.kind).toBe("unclaimed_review");

      const keepRes = await postPendingRegistrationTwin(request, env.internalSecret, {
        registeredId: keepPendingId,
        unregisteredId: keepListingId,
        action: "keep_both",
      });
      expect(keepRes.status()).toBe(200);

      const { data: keepSuggestion, error: keepSugErr } = await admin
        .from("directory_duplicate_suggestions")
        .select("status")
        .eq("manual_id", keepListingId)
        .eq("doctor_id", keepPendingId)
        .maybeSingle();
      if (keepSugErr) throw new Error(keepSugErr.message);
      expect(keepSuggestion?.status).toBe("dismissed");

      const { data: keepListing, error: keepListErr } = await admin
        .from("professionals")
        .select("is_archived, is_registered")
        .eq("id", keepListingId)
        .single();
      if (keepListErr) throw new Error(keepListErr.message);
      expect(keepListing?.is_archived).toBe(false);
      expect(keepListing?.is_registered).toBe(false);

      const afterKeep = classifyPendingRegistrationOrigin({
        claimSource: null,
        doctor: {
          doctorId: keepPendingId,
          name: keepName,
          specialty: "Dentistry",
          district: "Limassol",
        },
        unregisteredListings: activeListings.filter((l) => l.id !== twinListingId),
        dismissedUnregisteredIds: new Set([keepListingId]),
      });
      expect(afterKeep.kind).toBe("unclaimed_review");
      expect(afterKeep.twins).toEqual([]);
    } finally {
      const ids = [
        twinListingId,
        keepListingId,
        autoListingId,
        autoRegisteredId,
        pendingId,
        keepPendingId,
        unclaimedId,
        claimedOnlyId,
      ].filter(Boolean);
      for (const id of Array.from(new Set(ids))) {
        await admin.from("directory_duplicate_suggestions").delete().eq("manual_id", id);
        await admin.from("directory_duplicate_suggestions").delete().eq("doctor_id", id);
        await admin.from("professionals").delete().eq("id", id);
      }
      for (const authId of [authPending, authKeep, authUnclaimed, authAuto, authClaimed]) {
        if (authId) await admin.auth.admin.deleteUser(authId);
      }
    }
  });
});
