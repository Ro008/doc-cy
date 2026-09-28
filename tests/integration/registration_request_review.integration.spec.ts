import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createQaClaimDirectoryClone } from "./helpers/qa-claim-directory";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  REGISTER_AVATAR_FIXTURE,
  REGISTER_SMALL_AVATAR_FIXTURE,
  uniqueRegisterTestMobile,
} from "./helpers/goto-register-practice-step";
import { seedRealContactHolder } from "./helpers/contact-holder";
import {
  adminCookieHeader,
  createTestAdmin,
  deleteTestAdmin,
  sessionCookies,
  sharedTestFounder,
  type TestAdmin,
} from "./helpers/test-admin";
import { deleteTestCatalogueSpecialty, deleteTestClinics, loginDoctorUi } from "./helpers/test-doctor";

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
  /** Catalogue labels a test approved into existence (deleted once unused). */
  catalogue: string[];
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
  input: {
    lastName: string;
    clinicId: string;
    clinicAddress: string;
    clinicDistrict: string;
    claimId?: string | null;
    mobile?: string;
    /** The proposed clinic's phone; null = a request from before clinic phones were asked. */
    newClinicPhone?: string | null;
  },
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
    mobile: input.mobile ?? uniqueRegisterTestMobile(),
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
        phone: input.newClinicPhone === undefined ? "24123456" : input.newClinicPhone,
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
  const cleanup: Cleanup = { catalogue: [], logins: [], professionals: [], clinics: [], photos: [] };

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
    for (const name of cleanup.catalogue) await deleteTestCatalogueSpecialty(admin, name);
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
    // The proposed clinic was created with its phone.
    const { data: created } = await admin.from("clinics").select("phone").eq("id", links![1]!.clinic_id).single();
    expect(created?.phone).toBe("24123456");

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

    // Pasted without the scheme ("localhost:3000/en/…") it still works.
    const bare = `${baseUrl()}${listing.profilePath}`.replace(/^https?:\/\//, "");
    const bareLookup = await request.get(
      `${baseUrl()}/api/internal/requests/listing?url=${encodeURIComponent(bare)}`,
      { headers },
    );
    expect(bareLookup.status(), await bareLookup.text()).toBe(200);

    // A URL from another site (the live site, when testing locally) is refused clearly.
    const otherSite = new URL(baseUrl()).hostname === "localhost" ? "https://www.mydoccy.com" : "http://localhost:3000";
    const wrongSite = await request.get(
      `${baseUrl()}/api/internal/requests/listing?url=${encodeURIComponent(`${otherSite}${listing.profilePath}`)}`,
      { headers },
    );
    expect(wrongSite.status()).toBe(400);
    expect(await wrongSite.text()).toMatch(/another site/i);

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

  test("a new clinic without a phone can't be approved until a founder adds one", async ({ request }) => {
    const seeded = await seedRequest(admin, cleanup, {
      lastName: `Nophone ${Date.now().toString(36)}`,
      clinicId: clinic.id,
      clinicAddress: clinic.address,
      clinicDistrict: clinic.district,
      newClinicPhone: null,
    });
    const url = `${baseUrl()}/api/internal/requests/${seeded.requestId}/approve`;
    const headers = { cookie: adminCookieHeader(founder) };
    const refused = await request.post(url, { headers, data: {} });
    expect(refused.status()).toBe(400);
    expect(await refused.text()).toMatch(/phone number/i);

    const { details } = await loadRequest(admin, seeded.requestId);
    const withPhone = details as { clinics: Array<Record<string, unknown>> };
    const fixed = await request.post(url, {
      headers,
      data: {
        details: {
          ...withPhone,
          clinics: withPhone.clinics.map((c, i) => (i === 1 ? { ...c, phone: "+357 24 654321" } : c)),
        },
      },
    });
    expect(fixed.status(), await fixed.text()).toBe(200);
    const { outcome } = await recordOutcome(admin, cleanup, seeded.requestId);
    const createdId = outcome.clinics?.find((c) => c.created)?.clinic_id;
    const { data: created } = await admin.from("clinics").select("phone").eq("id", createdId!).single();
    expect(created?.phone).toBe("24654321");
  });

  test("founders replace the photo with the same checks and crop as the form", async ({ page }) => {
    test.setTimeout(240_000);
    const seeded = await seedRequest(admin, cleanup, {
      lastName: `Photo ${Date.now().toString(36)}`,
      clinicId: clinic.id,
      clinicAddress: clinic.address,
      clinicDistrict: clinic.district,
    });
    await signInAsAdmin(page, founder);
    await page.goto("/internal/directory", { waitUntil: "domcontentloaded" });
    const card = page.locator(`[data-request-id='${seeded.requestId}']`);
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("#requests[data-hydrated='1']")).toBeAttached({ timeout: 120_000 });
    const photoInput = card.getByTestId("request-photo-file-input");

    // Too small: refused with the form's message, no dialog.
    await photoInput.setInputFiles(REGISTER_SMALL_AVATAR_FIXTURE);
    await expect(card.getByTestId("request-photo-error")).toContainText(/too small/i, { timeout: 20_000 });
    await expect(page.getByRole("dialog", { name: "Crop the photo" })).toHaveCount(0);

    // A normal photo opens the same round crop dialog; confirming stores the crop.
    await photoInput.setInputFiles(REGISTER_AVATAR_FIXTURE);
    const dialog = page.getByRole("dialog", { name: "Crop the photo" });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByLabel("Zoom")).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm crop" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(card.getByRole("img", { name: /Applicant photo/ })).toHaveAttribute("src", /founder-/, {
      timeout: 30_000,
    });

    // The stored replacement is the cropped JPEG (900×900, well under the 1 MB limit).
    const { data: uploads } = await admin.storage
      .from("request-uploads")
      .list(`professional_registration/${seeded.authUserId}`);
    const founderPhoto = (uploads ?? []).find((file) => file.name.startsWith("founder-"));
    expect(founderPhoto?.name).toMatch(/\.jpg$/);
    cleanup.photos.push({
      bucket: "request-uploads",
      path: `professional_registration/${seeded.authUserId}/${founderPhoto!.name}`,
    });
  });

  test("approving is refused while another professional uses the mobile", async ({ request }) => {
    const mobile = uniqueRegisterTestMobile();
    const holder = await seedRealContactHolder(admin, { mobile });
    try {
      const seeded = await seedRequest(admin, cleanup, {
        lastName: `Taken ${Date.now().toString(36)}`,
        clinicId: clinic.id,
        clinicAddress: clinic.address,
        clinicDistrict: clinic.district,
        mobile,
      });
      const url = `${baseUrl()}/api/internal/requests/${seeded.requestId}/approve`;
      const headers = { cookie: adminCookieHeader(founder) };

      const refused = await request.post(url, { headers, data: {} });
      expect(refused.status()).toBe(409);
      expect(await refused.text()).toMatch(/mobile number is already used by another professional/i);
      expect((await loadRequest(admin, seeded.requestId)).status).toBe("pending");

      // A founder can correct it to the applicant's real number and approve.
      const { details } = await loadRequest(admin, seeded.requestId);
      const fixed = await request.post(url, {
        headers,
        data: { details: { ...(details as Record<string, unknown>), mobile: uniqueRegisterTestMobile() } },
      });
      expect(fixed.status(), await fixed.text()).toBe(200);
      await recordOutcome(admin, cleanup, seeded.requestId);
    } finally {
      await holder.remove();
    }
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
    // Requests is the dashboard's default tab.
    await page.goto("/internal/directory", { waitUntil: "domcontentloaded" });
    const tabs = page.getByRole("navigation", { name: "Dashboard sections" });
    await expect(tabs.getByRole("link", { name: /^Requests/ })).toHaveAttribute("aria-current", "page", {
      timeout: 60_000,
    });

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
    await expect(card.getByRole("alert")).toContainText(/not a profile URL/i, { timeout: 20_000 });
    await expect(card.getByRole("button", { name: "APPROVE" })).toBeDisabled();
    await card.getByLabel("Listing URL").fill("");
    await expect(card.getByRole("button", { name: "APPROVE" })).toBeEnabled();

    await card.getByLabel("Last name").fill(`${lastName} Ui`);

    // Languages are the form's pills, not free text: the applicant's English is on,
    // and a founder adds Russian with one click.
    await expect(card.getByLabel(/Languages \(comma-separated\)/)).toHaveCount(0);
    await expect(card.getByTestId("request-language-option-English").getByRole("checkbox")).toBeChecked();
    await card.getByTestId("request-language-option-Russian").click();
    await expect(card.getByTestId("request-language-option-Russian").getByRole("checkbox")).toBeChecked();

    // Founders can add a specialty (from the catalogue, or a new label) with its licence.
    const { data: catalogueRow } = await admin
      .from("specialties")
      .select("name")
      .neq("slug", "cardiology")
      .order("name")
      .limit(1)
      .single();
    const addedSpecialty = String(catalogueRow!.name);
    // Each section is its own panel with a count; each item its own card.
    await expect(card.getByRole("heading", { name: "Specialties (1)" })).toBeVisible();
    await expect(card.getByRole("heading", { name: "Clinics (2)" })).toBeVisible();
    await card.getByRole("button", { name: "Add specialty" }).click();
    await expect(card.getByRole("heading", { name: "Specialties (2)" })).toBeVisible();
    await card.getByLabel("Specialty 2", { exact: true }).fill(addedSpecialty);
    await card.getByTestId("request-specialty-licence-1").fill("ADD-77");
    await expect(card.getByTestId("request-specialty-kind-1")).toHaveText(/From the catalogue/);

    // A specialty that isn't in the catalogue yet: the box says so, approving adds it.
    const newLabel = `Review Newlabel ${lastName.replace(/[^a-z]/gi, "")}`;
    cleanup.catalogue.push(newLabel);
    await card.getByRole("button", { name: "Add specialty" }).click();
    const newName = card.getByLabel("Specialty 3", { exact: true });
    await expect(newName).toHaveAttribute("placeholder", /type a new specialty/i);
    await newName.fill(newLabel);
    await card.getByTestId("request-specialty-licence-2").fill("NEW-88");
    await expect(card.getByTestId("request-specialty-kind-2")).toHaveText(/New specialty: approving adds it to the catalogue/);

    // …and a clinic: here an existing DocCy clinic, found with the row's search.
    const { data: otherClinic } = await admin
      .from("clinics")
      .select("id, name")
      .eq("is_archived", false)
      .neq("id", clinic.id)
      .not("address", "is", null)
      .ilike("name", "%medical%")
      .limit(1)
      .single();
    await card.getByRole("button", { name: "Add clinic" }).click();
    const addedRow = card.locator("[data-request-clinic-row='2']");
    await expect(addedRow).toContainText("new clinic");
    await addedRow.getByPlaceholder("Search clinics…").fill(String(otherClinic!.name));
    await addedRow.locator("li button", { hasText: String(otherClinic!.name) }).first().click();
    await expect(addedRow).toContainText("existing DocCy clinic");

    await card.getByRole("button", { name: "APPROVE" }).click();
    await expect(card.getByText(/Approved/)).toBeVisible({ timeout: 30_000 });

    const { row } = await recordOutcome(admin, cleanup, seeded.requestId);
    const { data: approvedLinks } = await admin
      .from("professional_clinics")
      .select("clinic_id, sort_order")
      .eq("professional_id", row.professional_id!)
      .order("sort_order");
    expect(approvedLinks?.map((l) => l.clinic_id)).toContain(otherClinic!.id);
    expect(row.status).toBe("approved");
    expect((row.approved_details as { last_name: string }).last_name).toBe(`${lastName} Ui`);
    const { data: approvedPro } = await admin
      .from("professionals")
      .select("languages")
      .eq("id", row.professional_id!)
      .single();
    expect(approvedPro?.languages).toEqual(["English", "Russian"]);
    const { data: proSpecialties } = await admin
      .from("professional_specialties")
      .select("license_number, specialties(name)")
      .eq("professional_id", row.professional_id!);
    expect(
      (proSpecialties ?? []).map((ps) => ({
        name: (ps.specialties as unknown as { name: string }).name,
        license: ps.license_number,
      })),
    ).toEqual(
      expect.arrayContaining([
        { name: addedSpecialty, license: "ADD-77" },
        { name: newLabel, license: "NEW-88" },
      ]),
    );
    const { data: catalogueEntry } = await admin.from("specialties").select("id").eq("name", newLabel).maybeSingle();
    expect(catalogueEntry?.id, "the new label joined the catalogue").toBeTruthy();

    // Everything else lives on the Statistics tab, and its links keep that tab.
    await tabs.getByRole("link", { name: "Statistics" }).click();
    await expect(page).toHaveURL(/[?&]tab=statistics/, { timeout: 30_000 });
    await expect(page.locator("#requests")).toHaveCount(0);
    await expect(page.locator("#professional-directory")).toBeVisible({ timeout: 60_000 });
  });
});
