import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createQaClaimDirectoryClone } from "./helpers/qa-claim-directory";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { REGISTER_AVATAR_FIXTURE } from "./helpers/goto-register-practice-step";
import {
  adminCookieHeader,
  createTestAdmin,
  deleteTestAdmin,
  sessionCookies,
  sharedTestFounder,
  type TestAdmin,
} from "./helpers/test-admin";
import { deleteTestClinics, loginDoctorUi } from "./helpers/test-doctor";

/**
 * Build PR 4 of the registration redesign: founders review professional_registration
 * requests in the dashboard's Requests section and approve (new profile, or a claimed
 * listing updated in place) or deny them.
 *
 * Requests are permanent, so the decided requests stay in Testing's log. Professionals,
 * logins, created clinics, photos and the QA listing are removed.
 */

const baseUrl = () => (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").replace(/\/+$/, "");

type Seeded = { requestId: string; authUserId: string; email: string; photoPath: string };

type Cleanup = {
  logins: string[];
  professionals: string[];
  clinics: string[];
  photos: { bucket: string; path: string }[];
};

async function anyActiveClinic(admin: SupabaseClient): Promise<{ id: string; address: string; district: string }> {
  const { data, error } = await admin
    .from("clinics")
    .select("id, address, district")
    .eq("is_archived", false)
    .not("address", "is", null)
    .not("latitude", "is", null)
    .limit(1)
    .single();
  if (error || !data) throw new Error(`No clinic to pick: ${error?.message}`);
  return { id: data.id, address: data.address, district: data.district };
}

/** A confirmed applicant with a pending registration request (what PR 3's submit + confirm produce). */
async function seedRequest(
  admin: SupabaseClient,
  cleanup: Cleanup,
  input: { lastName: string; clinicId: string; clinicAddress: string; clinicDistrict: string; claimId?: string | null },
): Promise<Seeded> {
  const email = `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@integration.test`;
  const created = await admin.auth.admin.createUser({ email, password: "StrongPass123!", email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`login: ${created.error?.message}`);
  const authUserId = created.data.user.id;
  cleanup.logins.push(authUserId);

  const photoPath = `professional_registration/${authUserId}/photo-seed.jpg`;
  const upload = await admin.storage
    .from("request-uploads")
    .upload(photoPath, fs.readFileSync(REGISTER_AVATAR_FIXTURE), { contentType: "image/jpeg" });
  if (upload.error) throw new Error(`photo: ${upload.error.message}`);
  cleanup.photos.push({ bucket: "request-uploads", path: photoPath });

  const details = {
    first_name: "Review",
    last_name: input.lastName,
    gender: "female",
    gesy: true,
    email,
    mobile: "+35799123456",
    languages: ["English"],
    photo: { bucket: "request-uploads", path: photoPath },
    specialties: [{ name: "Cardiology", from_catalogue: true, license_number: "REV-1" }],
    clinics: [
      {
        clinic_id: input.clinicId,
        name: null,
        address: input.clinicAddress,
        district: input.clinicDistrict,
        town: null,
        latitude: 35.1,
        longitude: 33.3,
        place_id: null,
      },
      {
        clinic_id: null,
        name: `Review New Clinic ${input.lastName}`,
        address: "5 Review Street, Larnaca",
        district: "Larnaca",
        town: "Larnaca",
        latitude: 34.92,
        longitude: 33.63,
        place_id: null,
      },
    ],
    claimed_professional_id: input.claimId ?? null,
    disclaimer_accepted: true,
  };
  const draft = await admin.rpc("request_draft_submit", {
    p_request_type: "professional_registration",
    p_auth_user_id: authUserId,
    p_details: details,
    p_details_version: 1,
    p_requester_name: `Review ${input.lastName}`,
    p_requester_email: email,
  });
  if (draft.error) throw new Error(`draft: ${draft.error.message}`);
  const confirmed = await admin.rpc("request_draft_confirm", { p_auth_user_id: authUserId });
  if (confirmed.error) throw new Error(`confirm: ${confirmed.error.message}`);
  const requestId = String((confirmed.data as Array<{ request_id: string }>)[0]!.request_id);
  return { requestId, authUserId, email, photoPath };
}

async function loadRequest(admin: SupabaseClient, id: string) {
  const { data } = await admin
    .from("request_log")
    .select("status, professional_id, details, approved_details, outcome, decision_note")
    .eq("id", id)
    .single();
  return data!;
}

async function recordOutcome(admin: SupabaseClient, cleanup: Cleanup, requestId: string) {
  const row = await loadRequest(admin, requestId);
  const outcome = (row.outcome ?? {}) as {
    professional_id?: string;
    claimed_listing?: boolean;
    avatar_path?: string | null;
    clinics?: Array<{ clinic_id: string; created: boolean }>;
  };
  if (outcome.professional_id) cleanup.professionals.push(outcome.professional_id);
  for (const clinic of outcome.clinics ?? []) if (clinic.created) cleanup.clinics.push(clinic.clinic_id);
  if (outcome.avatar_path) cleanup.photos.push({ bucket: "avatars", path: outcome.avatar_path });
  return { row, outcome };
}

async function signInAsAdmin(page: Page, admin: TestAdmin) {
  const url = new URL(baseUrl());
  await page.context().addCookies(
    sessionCookies(admin.session!).map((c) => ({
      name: c.name,
      value: c.value,
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "Lax" as const,
    })),
  );
}

test.describe("Integration: registration request review", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial", retries: 0 });

  let admin: SupabaseClient;
  let founder: TestAdmin;
  let clinic: { id: string; address: string; district: string };
  const cleanup: Cleanup = { logins: [], professionals: [], clinics: [], photos: [] };

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    founder = await sharedTestFounder();
    clinic = await anyActiveClinic(admin);
  });

  test.afterAll(async () => {
    for (const id of cleanup.professionals) {
      await admin.from("professionals").delete().eq("id", id);
    }
    await deleteTestClinics(admin, cleanup.clinics);
    for (const photo of cleanup.photos) await admin.storage.from(photo.bucket).remove([photo.path]);
    for (const id of cleanup.logins) await admin.auth.admin.deleteUser(id);
  });

  test("approving a new profile creates it with the founders' corrections", async ({ request, page }) => {
    test.setTimeout(120_000);
    const lastName = `Newpro ${Date.now().toString(36)}`;
    const seeded = await seedRequest(admin, cleanup, {
      lastName,
      clinicId: clinic.id,
      clinicAddress: clinic.address,
      clinicDistrict: clinic.district,
    });
    const url = `${baseUrl()}/api/internal/requests/${seeded.requestId}/approve`;
    const { details } = await loadRequest(admin, seeded.requestId);
    const corrected = { ...(details as Record<string, unknown>), last_name: `${lastName} Fixed` };

    // Partners are read-only.
    const partner = await createTestAdmin({ role: "partner", withTotp: true });
    try {
      const denied = await request.post(url, {
        headers: { cookie: adminCookieHeader(partner) },
        data: { details: corrected },
      });
      expect(denied.status()).toBe(403);
    } finally {
      await deleteTestAdmin(partner);
    }

    // The email is the login and can't be changed.
    const badEmail = await request.post(url, {
      headers: { cookie: adminCookieHeader(founder) },
      data: { details: { ...corrected, email: "someone-else@integration.test" } },
    });
    expect(badEmail.status()).toBe(400);

    const approved = await request.post(url, {
      headers: { cookie: adminCookieHeader(founder) },
      data: { details: corrected, trialMonths: 2 },
    });
    expect(approved.status(), await approved.text()).toBe(200);
    const body = (await approved.json()) as { professionalId: string; slug: string };

    const { row, outcome } = await recordOutcome(admin, cleanup, seeded.requestId);
    expect(row.status).toBe("approved");
    expect(row.professional_id).toBe(body.professionalId);
    expect((row.approved_details as { last_name: string }).last_name).toBe(`${lastName} Fixed`);
    expect(outcome.claimed_listing).toBe(false);

    const { data: pro } = await admin
      .from("professionals")
      .select("name, slug, status, is_registered, auth_user_id, avatar_url, pro_access_until, gender, is_gesy")
      .eq("id", body.professionalId)
      .single();
    expect(pro).toMatchObject({
      name: `Review ${lastName} Fixed`,
      slug: body.slug,
      status: "verified",
      is_registered: true,
      auth_user_id: seeded.authUserId,
      gender: "female",
      is_gesy: true,
    });
    expect(pro!.pro_access_until).toBeTruthy();
    // The reviewed photo was copied to the public avatars bucket.
    expect(String(pro!.avatar_url)).toMatch(new RegExp(`^profiles/${seeded.authUserId}/avatar-`));
    const avatar = await admin.storage.from("avatars").download(String(pro!.avatar_url));
    expect(avatar.error).toBeNull();

    const { data: links } = await admin
      .from("professional_clinics")
      .select("clinic_id, is_primary")
      .eq("professional_id", body.professionalId)
      .order("sort_order");
    expect(links?.map((l) => l.clinic_id)[0]).toBe(clinic.id);
    expect(links).toHaveLength(2);

    // The public profile is live.
    await page.goto(`/en/${body.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`${lastName} Fixed`, { timeout: 30_000 });

    // The professional signs in and finds their clinics (clinic tables only, no doctor_locations).
    // (The one-time welcome notice is skipped, as createTestDoctor does.)
    await admin.from("professionals").update({ trial_notice_seen_at: new Date().toISOString() }).eq("id", body.professionalId);
    await loginDoctorUi(page, seeded.email, "StrongPass123!");
    await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });
    const clinicTabs = page.getByRole("tablist", { name: "Clinics" }).getByRole("tab");
    await expect(clinicTabs).toHaveCount(2);
    // The form is server-rendered: retry until React has hydrated and the tab switches.
    await expect(async () => {
      await clinicTabs.nth(1).click();
      await expect(clinicTabs.nth(1)).toHaveAttribute("aria-selected", "true", { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByText(/5 Review Street/).first()).toBeVisible({ timeout: 20_000 });

    // Deciding twice is refused.
    const again = await request.post(url, {
      headers: { cookie: adminCookieHeader(founder) },
      data: { details: corrected },
    });
    expect(again.status()).toBe(409);
  });

  test("a pasted listing URL makes it a claim, and approving updates the listing in place", async ({ request }) => {
    test.setTimeout(120_000);
    const nonce = Date.now().toString(36).replace(/\d/g, (d) => "abcdefghij"[Number(d)]!);
    const listing = await createQaClaimDirectoryClone(admin, nonce);
    cleanup.professionals.push(listing.id);
    const seeded = await seedRequest(admin, cleanup, {
      lastName: `Claimer ${nonce}`,
      clinicId: clinic.id,
      clinicAddress: clinic.address,
      clinicDistrict: clinic.district,
    });
    const headers = { cookie: adminCookieHeader(founder) };

    // Only a valid URL of an unregistered listing is accepted.
    const junk = await request.get(`${baseUrl()}/api/internal/requests/listing?url=${encodeURIComponent("not a url")}`, {
      headers,
    });
    expect(junk.status()).toBe(400);
    const lookup = await request.get(
      `${baseUrl()}/api/internal/requests/listing?url=${encodeURIComponent(`${baseUrl()}${listing.profilePath}`)}`,
      { headers },
    );
    expect(lookup.status(), await lookup.text()).toBe(200);
    expect(((await lookup.json()) as { listing: { id: string } }).listing.id).toBe(listing.id);

    const { details } = await loadRequest(admin, seeded.requestId);
    const approved = await request.post(`${baseUrl()}/api/internal/requests/${seeded.requestId}/approve`, {
      headers,
      data: { details: { ...(details as Record<string, unknown>), claimed_professional_id: listing.id } },
    });
    expect(approved.status(), await approved.text()).toBe(200);
    const { row, outcome } = await recordOutcome(admin, cleanup, seeded.requestId);
    expect(outcome.claimed_listing).toBe(true);
    expect(row.professional_id).toBe(listing.id);

    const { data: pro } = await admin
      .from("professionals")
      .select("id, is_registered, auth_user_id, name, slug")
      .eq("id", listing.id)
      .single();
    expect(pro).toMatchObject({ is_registered: true, auth_user_id: seeded.authUserId, name: `Review Claimer ${nonce}` });
    // The name changed, so the listing got a new slug and the old one redirects.
    expect(pro!.slug).not.toBe(listing.slug);
    const { data: redirect } = await admin
      .from("professional_slug_redirects")
      .select("professional_id")
      .eq("slug", listing.slug)
      .maybeSingle();
    expect(redirect?.professional_id).toBe(listing.id);

    // Now registered, the listing is no longer claimable.
    const taken = await request.get(
      `${baseUrl()}/api/internal/requests/listing?url=${encodeURIComponent(`${baseUrl()}/en/${pro!.slug}`)}`,
      { headers },
    );
    expect(taken.status()).toBe(409);
  });

  test("denying needs a reason and records it", async ({ request }) => {
    const seeded = await seedRequest(admin, cleanup, {
      lastName: `Denied ${Date.now().toString(36)}`,
      clinicId: clinic.id,
      clinicAddress: clinic.address,
      clinicDistrict: clinic.district,
    });
    const url = `${baseUrl()}/api/internal/requests/${seeded.requestId}/deny`;
    const headers = { cookie: adminCookieHeader(founder) };
    const noReason = await request.post(url, { headers, data: { reason: "  " } });
    expect(noReason.status()).toBe(400);
    const denied = await request.post(url, { headers, data: { reason: "Licence number not found" } });
    expect(denied.status(), await denied.text()).toBe(200);
    const row = await loadRequest(admin, seeded.requestId);
    expect(row.status).toBe("rejected");
    expect(row.decision_note).toBe("Licence number not found");
  });

  test("the Requests section shows a pending request and approves it", async ({ page }) => {
    test.setTimeout(240_000);
    const lastName = `Uiflow ${Date.now().toString(36)}`;
    const seeded = await seedRequest(admin, cleanup, {
      lastName,
      clinicId: clinic.id,
      clinicAddress: clinic.address,
      clinicDistrict: clinic.district,
    });
    await signInAsAdmin(page, founder);
    await page.goto("/internal/directory#requests", { waitUntil: "domcontentloaded" });

    const card = page.locator(`[data-request-id='${seeded.requestId}']`);
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card.getByText("UNCLAIMED PROFILE")).toBeVisible();
    await expect(card.getByLabel("Last name")).toHaveValue(lastName);
    await expect(card.getByLabel("Email")).toBeDisabled();
    await expect(card.getByRole("img", { name: /photo/i })).toBeVisible();

    // An invalid listing URL blocks approval until it is fixed or cleared.
    // The dashboard is server-rendered and heavy: type only once React has hydrated it.
    await expect(page.locator("#requests[data-hydrated='1']")).toBeAttached({ timeout: 120_000 });
    await card.getByLabel("Listing URL").fill("https://www.mydoccy.com/paphos/cardiology");
    await card.getByRole("button", { name: "Check listing" }).click();
    await expect(card.getByRole("alert")).toContainText(/not a profile URL/i);
    await expect(card.getByRole("button", { name: "APPROVE" })).toBeDisabled();
    await card.getByLabel("Listing URL").fill("");
    await expect(card.getByRole("button", { name: "APPROVE" })).toBeEnabled();

    await card.getByLabel("Last name").fill(`${lastName} Ui`);
    await card.getByRole("button", { name: "APPROVE" }).click();
    await expect(card.getByText(/Approved/)).toBeVisible({ timeout: 30_000 });

    const { row } = await recordOutcome(admin, cleanup, seeded.requestId);
    expect(row.status).toBe("approved");
    expect((row.approved_details as { last_name: string }).last_name).toBe(`${lastName} Ui`);
  });
});
