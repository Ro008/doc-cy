import { expect, test } from "@playwright/test";

import { classifyPendingRegistrationOrigin } from "@/lib/pending-registration-origin";
import { pickUniqueDirectoryClaim } from "@/lib/claim-directory-professional";
import {
  createIntegrationAdmin,
  requireSafeIntegration,
} from "./helpers/safe-integration";
import { postDoctorVerification } from "./helpers/internal-api";
import { seedProfessionalSpecialty } from "./helpers/test-doctor";

/**
 * Founder pending registration flows: Claimed/Unclaimed badges, verify+absorb via URL,
 * and card-link claims that must never mutate the claimed listing before Verify.
 */
test.describe("Integration: pending registration origin actions", { tag: "@pr-e2e" }, () => {
  test("classifies claimed/unclaimed and verify absorbs from URL", async ({ request }) => {
    // Multiple auth users + listings + verify/reject/absorb RPCs exceed the default 30s budget.
    test.setTimeout(120_000);
    const env = requireSafeIntegration({ needsInternalSecret: true });
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    let authPending = "";
    let authAuto = "";
    let pendingId = "";
    let twinListingId = "";
    let unclaimedId = "";
    let authUnclaimed = "";
    let autoListingId = "";
    let autoRegisteredId = "";
    let claimedVerifyId = "";
    let authClaimedVerify = "";
    let claimVerifyTargetListingId = "";
    let claimedRejectId = "";
    let authClaimedReject = "";
    let claimRejectTargetListingId = "";
    let registeredBlockerId = "";
    let authBlocker = "";

    const twinName = `Pending Twin ${nonce}`;
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

      const createClaimedVerifyUser = await admin.auth.admin.createUser({
        email: `claimed-verify-${nonce}@integration.test`,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createClaimedVerifyUser.error || !createClaimedVerifyUser.data.user?.id) {
        throw new Error(`claimed verify auth: ${createClaimedVerifyUser.error?.message}`);
      }
      authClaimedVerify = createClaimedVerifyUser.data.user.id;

      const createClaimedRejectUser = await admin.auth.admin.createUser({
        email: `claimed-reject-${nonce}@integration.test`,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createClaimedRejectUser.error || !createClaimedRejectUser.data.user?.id) {
        throw new Error(`claimed reject auth: ${createClaimedRejectUser.error?.message}`);
      }
      authClaimedReject = createClaimedRejectUser.data.user.id;

      const createBlockerUser = await admin.auth.admin.createUser({
        email: `registered-blocker-${nonce}@integration.test`,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createBlockerUser.error || !createBlockerUser.data.user?.id) {
        throw new Error(`blocker auth: ${createBlockerUser.error?.message}`);
      }
      authBlocker = createBlockerUser.data.user.id;

      const listings = await admin
        .from("professionals")
        .insert([
          {
            name: twinName,
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
            name: autoName,
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
          {
            name: `Claim Verify Target ${nonce}`,
            district: "Limassol",
            slug: `claim-verify-target-${nonce}`,
            address_maps_link: "https://maps.google.com/?q=claim-verify-target",
            is_registered: false,
            has_online_booking: false,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
          },
          {
            name: `Claim Reject Target ${nonce}`,
            district: "Famagusta",
            slug: `claim-reject-target-${nonce}`,
            address_maps_link: "https://maps.google.com/?q=claim-reject-target",
            is_registered: false,
            has_online_booking: false,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
          },
        ])
        .select("id, name, email, district, slug");
      if (listings.error || !listings.data || listings.data.length !== 4) {
        throw new Error(`listings insert: ${listings.error?.message}`);
      }
      twinListingId = String(listings.data[0].id);
      autoListingId = String(listings.data[1].id);
      claimVerifyTargetListingId = String(listings.data[2].id);
      claimRejectTargetListingId = String(listings.data[3].id);
      for (const listing of listings.data) {
        await seedProfessionalSpecialty(admin, String(listing.id), { specialty: "Dentist" });
      }

      const pendingRows = await admin
        .from("professionals")
        .insert([
          {
            auth_user_id: authPending,
            name: twinName,
            district: "Paphos",
            registration_email: `pending-twin-${nonce}@integration.test`,
            mobile_number: "+35799111111",
            languages: ["English"],
            license_file_url: `licenses/integration/${nonce}-twin.pdf`,
            status: "pending",
            slug: `pending-twin-reg-${nonce}`,
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
            district: "Larnaca",
            registration_email: `unclaimed-${nonce}@integration.test`,
            mobile_number: "+35799333333",
            languages: ["English"],
            license_file_url: `licenses/integration/${nonce}-unc.pdf`,
            status: "pending",
            slug: `unclaimed-reg-${nonce}`,
            is_registered: true,
            has_online_booking: true,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
            subscription_tier: "standard",
            directory_claim_source: null,
          },
          {
            auth_user_id: authClaimedVerify,
            name: `Card Claimed Verify ${nonce}`,
            district: "Limassol",
            registration_email: `claimed-verify-${nonce}@integration.test`,
            mobile_number: "+35799444444",
            languages: ["English"],
            license_file_url: `licenses/integration/${nonce}-card-v.pdf`,
            status: "pending",
            slug: `card-claimed-verify-reg-${nonce}`,
            is_registered: true,
            has_online_booking: true,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
            subscription_tier: "standard",
            directory_claim_source: "card_link",
            claim_listing_id: claimVerifyTargetListingId,
          },
          {
            auth_user_id: authClaimedReject,
            name: `Card Claimed Reject ${nonce}`,
            district: "Famagusta",
            registration_email: `claimed-reject-${nonce}@integration.test`,
            mobile_number: "+35799777777",
            languages: ["English"],
            license_file_url: `licenses/integration/${nonce}-card-r.pdf`,
            status: "pending",
            slug: `card-claimed-reject-reg-${nonce}`,
            is_registered: true,
            has_online_booking: true,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
            subscription_tier: "standard",
            directory_claim_source: "card_link",
            claim_listing_id: claimRejectTargetListingId,
          },
          {
            auth_user_id: authBlocker,
            name: `Already Registered ${nonce}`,
            district: "Limassol",
            registration_email: `registered-blocker-${nonce}@integration.test`,
            mobile_number: "+35799666666",
            languages: ["English"],
            license_file_url: `licenses/integration/${nonce}-block.pdf`,
            status: "verified",
            slug: `registered-blocker-${nonce}`,
            is_registered: true,
            has_online_booking: true,
            finder_visible: true,
            is_archived: false,
            is_test_profile: true,
            subscription_tier: "standard",
          },
        ])
        .select("id, name, district, directory_claim_source, status");
      if (pendingRows.error || !pendingRows.data || pendingRows.data.length !== 5) {
        throw new Error(`pending insert: ${pendingRows.error?.message}`);
      }
      pendingId = String(pendingRows.data[0].id);
      unclaimedId = String(pendingRows.data[1].id);
      claimedVerifyId = String(pendingRows.data[2].id);
      claimedRejectId = String(pendingRows.data[3].id);
      registeredBlockerId = String(pendingRows.data[4].id);
      const registeredSpecialties = [
        { specialty: "Dentist", licenseNumber: `LIC-TWIN-${nonce}` },
        { specialty: "Cardiology", licenseNumber: `LIC-UNC-${nonce}` },
        { specialty: "Dentist", licenseNumber: `LIC-CARD-V-${nonce}` },
        { specialty: "Dentist", licenseNumber: `LIC-CARD-R-${nonce}` },
        { specialty: "Dentist", licenseNumber: `LIC-BLOCK-${nonce}` },
      ];
      for (const [index, row] of pendingRows.data.entries()) {
        await seedProfessionalSpecialty(admin, String(row.id), registeredSpecialties[index]!);
      }

      expect(classifyPendingRegistrationOrigin({ claimSource: null }).kind).toBe(
        "unclaimed",
      );
      expect(
        classifyPendingRegistrationOrigin({ claimSource: "card_link" }).kind,
      ).toBe("claimed");
      expect(
        classifyPendingRegistrationOrigin({ claimSource: "email" }).kind,
      ).toBe("unclaimed");

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

      // Any claim (explicit card_link or fuzzy email match) must NEVER mutate
      // the claimed listing at signup — it stays live/untouched until Verify.
      const { data: autoRpc, error: autoRpcErr } = await admin.rpc(
        "register_professional_with_founder_lock",
        {
          p_auth_user_id: authAuto,
          p_name: autoName,
          p_email: autoEmail,
          p_phone: "+35799555555",
          p_languages: ["English"],
          p_license_file_url: `licenses/integration/${nonce}-auto.pdf`,
          p_slug: `auto-match-registration-${nonce}`,
          p_specialties: [
            { specialty: "Dentist", license_number: `LIC-AUTO-${nonce}`, is_approved: true },
          ],
          p_claim_listing_id: autoListingId,
          p_directory_claim_source: fuzzy!.reason,
        },
      );
      if (autoRpcErr || !autoRpc?.[0]?.professional_id) {
        throw new Error(`auto claim RPC: ${autoRpcErr?.message ?? "missing id"}`);
      }
      autoRegisteredId = String(autoRpc[0].professional_id);
      // A fresh row was inserted — the claimed listing is a *different* id.
      expect(autoRegisteredId).not.toBe(autoListingId);

      const { data: autoRow, error: autoRowErr } = await admin
        .from("professionals")
        .select("id, is_registered, directory_claim_source, claim_listing_id")
        .eq("id", autoRegisteredId)
        .single();
      if (autoRowErr) throw new Error(autoRowErr.message);
      expect(autoRow?.is_registered).toBe(true);
      expect(autoRow?.directory_claim_source).toBe("email");
      expect(autoRow?.claim_listing_id).toBe(autoListingId);

      // The claimed listing itself is completely untouched.
      const { data: autoListingRow, error: autoListingErr } = await admin
        .from("professionals")
        .select("is_registered, is_archived")
        .eq("id", autoListingId)
        .single();
      if (autoListingErr) throw new Error(autoListingErr.message);
      expect(autoListingRow?.is_registered).toBe(false);
      expect(autoListingRow?.is_archived).toBe(false);

      const blockedRes = await postDoctorVerification(request, env.internalSecret, {
        doctorId: pendingId,
        action: "verify",
        listingUrl: `https://mydoccy.com/en/registered-blocker-${nonce}`,
      });
      expect(blockedRes.status()).toBe(400);
      const blockedBody = (await blockedRes.json()) as { message?: string };
      expect(blockedBody.message).toMatch(/registered account/i);

      const verifyRes = await postDoctorVerification(request, env.internalSecret, {
        doctorId: pendingId,
        action: "verify",
        listingUrl: `https://mydoccy.com/en/pending-twin-listing-${nonce}`,
      });
      expect(verifyRes.status()).toBe(200);

      const { data: absorbedListing, error: absorbedErr } = await admin
        .from("professionals")
        .select("is_archived, status")
        .eq("id", twinListingId)
        .single();
      if (absorbedErr) throw new Error(absorbedErr.message);
      expect(absorbedListing?.is_archived).toBe(true);

      const { data: verifiedPending, error: verifiedErr } = await admin
        .from("professionals")
        .select("status")
        .eq("id", pendingId)
        .single();
      if (verifiedErr) throw new Error(verifiedErr.message);
      expect(verifiedPending?.status).toBe("verified");

      // Verifying a card-link claim absorbs the claimed listing (same RPC as
      // manual URL absorb) using the stored claim_listing_id — no listingUrl
      // needed from the founder.
      const verifyClaimedRes = await postDoctorVerification(request, env.internalSecret, {
        doctorId: claimedVerifyId,
        action: "verify",
      });
      expect(verifyClaimedRes.status()).toBe(200);

      const { data: verifiedClaimedRow, error: verifiedClaimedErr } = await admin
        .from("professionals")
        .select("status")
        .eq("id", claimedVerifyId)
        .single();
      if (verifiedClaimedErr) throw new Error(verifiedClaimedErr.message);
      expect(verifiedClaimedRow?.status).toBe("verified");

      const { data: absorbedClaimTarget, error: absorbedClaimTargetErr } = await admin
        .from("professionals")
        .select("is_archived")
        .eq("id", claimVerifyTargetListingId)
        .single();
      if (absorbedClaimTargetErr) throw new Error(absorbedClaimTargetErr.message);
      expect(absorbedClaimTarget?.is_archived).toBe(true);

      // Rejecting a card-link claim must NOT touch the claimed listing at all
      // (it was never mutated in the first place) — just close the pending
      // application, exactly like an Unclaimed reject.
      const rejectClaimedRes = await postDoctorVerification(request, env.internalSecret, {
        doctorId: claimedRejectId,
        action: "reject",
      });
      expect(rejectClaimedRes.status()).toBe(200);
      const rejectClaimedBody = (await rejectClaimedRes.json()) as { status?: string };
      expect(rejectClaimedBody.status).toBe("rejected");

      const { data: rejectedClaimedRow, error: rejectedClaimedErr } = await admin
        .from("professionals")
        .select("is_registered, status")
        .eq("id", claimedRejectId)
        .single();
      if (rejectedClaimedErr) throw new Error(rejectedClaimedErr.message);
      expect(rejectedClaimedRow?.is_registered).toBe(true);
      expect(rejectedClaimedRow?.status).toBe("rejected");

      const { data: untouchedClaimTarget, error: untouchedClaimTargetErr } = await admin
        .from("professionals")
        .select("is_registered, is_archived, slug, name")
        .eq("id", claimRejectTargetListingId)
        .single();
      if (untouchedClaimTargetErr) throw new Error(untouchedClaimTargetErr.message);
      expect(untouchedClaimTarget?.is_registered).toBe(false);
      expect(untouchedClaimTarget?.is_archived).toBe(false);
      expect(untouchedClaimTarget?.slug).toBe(`claim-reject-target-${nonce}`);
      expect(untouchedClaimTarget?.name).toBe(`Claim Reject Target ${nonce}`);

      // Rejecting an unclaimed registration keeps the existing behavior:
      // just close the application, nothing to revert in the finder.
      const rejectUnclaimedRes = await postDoctorVerification(request, env.internalSecret, {
        doctorId: unclaimedId,
        action: "reject",
      });
      expect(rejectUnclaimedRes.status()).toBe(200);
      const rejectUnclaimedBody = (await rejectUnclaimedRes.json()) as { status?: string };
      expect(rejectUnclaimedBody.status).toBe("rejected");

      const { data: rejectedUnclaimedRow, error: rejectedUnclaimedErr } = await admin
        .from("professionals")
        .select("is_registered, status")
        .eq("id", unclaimedId)
        .single();
      if (rejectedUnclaimedErr) throw new Error(rejectedUnclaimedErr.message);
      expect(rejectedUnclaimedRow?.is_registered).toBe(true);
      expect(rejectedUnclaimedRow?.status).toBe("rejected");
    } finally {
      const ids = [
        twinListingId,
        autoListingId,
        autoRegisteredId,
        pendingId,
        unclaimedId,
        claimedVerifyId,
        claimVerifyTargetListingId,
        claimedRejectId,
        claimRejectTargetListingId,
        registeredBlockerId,
      ].filter(Boolean);
      for (const id of Array.from(new Set(ids))) {
        await admin.from("professionals").delete().eq("id", id);
      }
      for (const authId of [
        authPending,
        authUnclaimed,
        authAuto,
        authClaimedVerify,
        authClaimedReject,
        authBlocker,
      ]) {
        if (authId) await admin.auth.admin.deleteUser(authId);
      }
    }
  });
});
