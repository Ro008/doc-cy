import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { adminCookieHeader, sharedTestFounder } from "./helpers/test-admin";
import {
  createTestDoctor,
  deleteTestClinics,
  deleteTestDoctor,
  loginDoctorUi,
  openPrimaryClinicForBookings,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * Settings → Clinics, "Request a change to clinic details" (user, 2026-10-11): each
 * clinic card shows its address and phone with one link. The dialog is only about the
 * clinic's name, address and phone; founders approve every change, because a clinic is
 * shared. One open request per clinic: the card says when it was sent, she can withdraw
 * it, a denial shows its reason, and founders may correct it before approving.
 * The Contact & phone section is gone, and its old links land on Clinics.
 */
test.describe("Integration: settings clinic details request", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let colleague: TestDoctorFixture | null = null;
  let page: Page;
  const nonce = `cdt${Date.now()}`.slice(-12);
  const digits = String(Date.now()).slice(-6);
  const startPhone = `22${digits}`;
  const newPhone = `99${digits}`;
  const clinicName = `Own Clinic ${nonce}`;
  const clinicIds: string[] = [];
  let clinicId = "";
  let linkId = "";

  const grouped = (phone: string) => `${phone.slice(0, 2)} ${phone.slice(2)}`;
  const shown = (phone: string) => `+357 ${grouped(phone)}`;
  const today = () =>
    new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Nicosia" }).format(
      new Date(),
    );
  const card = () => page.getByTestId("settings-clinic-card");
  const link = () => card().getByRole("button", { name: "Request a change to clinic details" });
  const dialog = () => page.getByRole("dialog", { name: /Request a change to .*details/ });
  const pending = () => card().getByTestId("settings-clinic-change-pending");
  const denied = () => card().getByTestId("settings-clinic-change-denied");
  const summary = () => dialog().getByTestId("settings-clinic-change-summary");
  const send = () => dialog().getByRole("button", { name: "Send request" });
  const clinicInDb = async () =>
    (await admin.from("clinics").select("name, phone, address, slug").eq("id", clinicId).single()).data!;
  const requests = async () =>
    (
      await admin
        .from("request_log")
        .select("id, status, details, before_snapshot, approved_details, outcome")
        .eq("professional_id", pro!.doctorId)
        .eq("request_type", "professional_clinic_details_change")
        .order("created_at", { ascending: true })
    ).data ?? [];
  const openDialog = async () => {
    await page.goto("/settings?section=clinics", { waitUntil: "domcontentloaded" });
    await expect(card()).toContainText(shown(startPhone), { timeout: 30_000 });
    // A click before hydration does nothing: retry until the dialog opens.
    await expect(async () => {
      await link().click();
      await expect(dialog()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  };
  const sendChange = async (name: string, phone: string) => {
    await openDialog();
    await dialog().getByLabel("Clinic name").fill(name);
    await dialog().getByLabel("Clinic phone").fill(phone);
    await expect(send()).toBeEnabled();
    await send().click();
    await expect(dialog()).toBeHidden({ timeout: 20_000 });
    await expect(pending()).toBeVisible({ timeout: 20_000 });
  };

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Clinic details ${nonce}`, specialty: "Cardiology" });
    const own = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicId = own.clinicId;
    linkId = own.locationId;
    clinicIds.push(own.clinicId);
    await admin.from("clinics").update({ name: clinicName, phone: startPhone }).eq("id", own.clinicId);
    // A colleague at the same clinic: a change applies for her too.
    colleague = await createTestDoctor({ admin, nonce: `${nonce}b`, name: `Colleague ${nonce}`, specialty: "Cardiology" });
    const { error } = await admin
      .from("professional_clinics")
      .insert({ professional_id: colleague.doctorId, clinic_id: clinicId, sort_order: 0 });
    if (error) throw new Error(`colleague link: ${error.message}`);

    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    if (colleague) await deleteTestDoctor(colleague);
    await deleteTestClinics(admin, clinicIds);
  });

  test("the clinic card shows its address and phone, with one link to ask for a change", async () => {
    await page.goto("/settings?section=clinics", { waitUntil: "domcontentloaded" });
    await expect(card().getByTestId("settings-clinic-phone")).toHaveText(shown(startPhone), { timeout: 30_000 });
    await expect(link()).toBeVisible();
    await expect(card().getByRole("button", { name: /Request (name or address|phone) change/ })).toHaveCount(0);
  });

  test("Contact & phone is gone; its old links land on Clinics", async () => {
    await page.goto("/settings?section=contact", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Clinics" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Contact & phone" })).toHaveCount(0);
    await expect(page.getByTestId("settings-clinic-phones")).toHaveCount(0);
  });

  test("the dialog shows what she is asking for, and sends only a real change", async () => {
    await openDialog();
    await expect(dialog().getByLabel("Clinic name")).toHaveValue(clinicName);
    await expect(dialog().getByLabel("Clinic phone")).toHaveValue(grouped(startPhone));
    await expect(summary()).toContainText("Nothing yet");
    await expect(send()).toBeDisabled();
    await expect(dialog().getByTestId("settings-clinic-change-shared")).toHaveText(
      "1 other professional works at this clinic: the change applies for them too.",
    );

    // Not a Cyprus landline or mobile.
    await dialog().getByLabel("Clinic phone").fill("80001234");
    await expect(dialog().getByRole("alert")).toContainText("Enter a Cyprus landline or mobile");
    await expect(send()).toBeDisabled();

    // A pasted country code is dropped; the summary shows old → new.
    await dialog().getByLabel("Clinic phone").fill(`+357${newPhone}`);
    await expect(dialog().getByLabel("Clinic phone")).toHaveValue(grouped(newPhone));
    await expect(summary()).toContainText("Phone:");
    await expect(summary()).toContainText(shown(startPhone));
    await expect(summary()).toContainText(`→ ${shown(newPhone)}`);
    await expect(summary()).not.toContainText("Name:");
    await expect(send()).toBeEnabled();

    await dialog().getByRole("button", { name: "Cancel" }).click();
    await expect(dialog()).toBeHidden();
    await expect(pending()).toHaveCount(0);
    expect(await requests()).toHaveLength(0);
  });

  test("sent: the card says when and what, the clinic is unchanged, and she can withdraw it", async () => {
    await sendChange(`Renamed Clinic ${nonce}`, newPhone);
    await expect(pending()).toContainText(`Request sent on ${today()}`);
    await expect(pending()).toContainText("waiting for DocCy’s approval");
    await expect(pending()).toContainText(`name “Renamed Clinic ${nonce}”`);
    await expect(pending()).toContainText(`phone “${shown(newPhone)}”`);
    // One request per clinic: no link while it waits; the live details stay.
    await expect(link()).toHaveCount(0);
    await expect(card()).toContainText(shown(startPhone));
    expect(await clinicInDb()).toMatchObject({ name: clinicName, phone: startPhone });

    let rows = await requests();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "pending",
      details: { clinic_id: clinicId, link_id: linkId, changes: { name: `Renamed Clinic ${nonce}`, phone: newPhone } },
      before_snapshot: { name: clinicName, phone: startPhone },
    });

    // Still there after a reload; the server refuses a second one for this clinic.
    await page.reload();
    await expect(pending()).toContainText(`Request sent on ${today()}`, { timeout: 30_000 });
    const second = await page.request.post("/api/clinic-change-requests", {
      data: { locationId: linkId, changes: { name: "Another name" } },
    });
    expect(second.status()).toBe(409);
    // Nor can she ask about a clinic that is not hers, or change nothing.
    const notHers = await page.request.post("/api/clinic-change-requests", {
      data: { locationId: "00000000-0000-4000-8000-000000000000", changes: { name: "X" } },
    });
    expect(notHers.status()).toBe(404);

    await expect(async () => {
      await pending().getByRole("button", { name: "Withdraw request" }).click();
      await expect(pending()).toHaveCount(0, { timeout: 5_000 });
    }).toPass({ timeout: 20_000 });
    await expect(link()).toBeVisible();
    rows = await requests();
    expect(rows.map((row) => row.status)).toEqual(["withdrawn"]);
    const nothing = await page.request.post("/api/clinic-change-requests", {
      data: { locationId: linkId, changes: { name: clinicName, phone: startPhone } },
    });
    expect(nothing.status()).toBe(400);
    expect((await nothing.json()).message).toBe("Change at least one detail.");
  });

  test("denied by a founder: the reason shows on the card until she dismisses it", async ({ request }) => {
    const founder = await sharedTestFounder();
    const headers = { cookie: adminCookieHeader(founder) };
    await sendChange(clinicName, newPhone);
    const rows = await requests();
    const id = rows[rows.length - 1]!.id as string;
    // A professional cannot decide requests.
    expect((await page.request.post(`/api/internal/clinic-requests/${id}/approve`, { data: {} })).status()).not.toBe(200);
    const deny = await request.post(`/api/internal/clinic-requests/${id}/deny`, {
      headers,
      data: { reason: "We could not reach the clinic on this number." },
    });
    expect(deny.status(), await deny.text()).toBe(200);

    // She tries to withdraw it on the stale page: too late.
    await pending().getByRole("button", { name: "Withdraw request" }).click();
    await expect(page.getByText(/DocCy has already decided this request/)).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(denied()).toContainText("Your request to change this clinic’s details was not approved", {
      timeout: 30_000,
    });
    await expect(denied()).toContainText("Reason: We could not reach the clinic on this number.");
    await expect(link()).toBeVisible();
    expect(await clinicInDb()).toMatchObject({ name: clinicName, phone: startPhone });
    await denied().getByRole("button", { name: "Dismiss" }).click();
    await expect(denied()).toHaveCount(0);
    await page.reload();
    await expect(card()).toContainText(shown(startPhone), { timeout: 30_000 });
    await expect(denied()).toHaveCount(0);
  });

  test("approved by a founder on the dashboard, with a correction: the clinic changes for everyone", async () => {
    const founder = await sharedTestFounder();
    await sendChange(`renamed clinic ${nonce}`, newPhone);
    const rows = await requests();
    const id = rows[rows.length - 1]!.id as string;
    const slugBefore = (await clinicInDb()).slug;

    const founderPage = await page.context().browser()!.newPage();
    try {
      await founderPage.goto("/login");
      await founderPage.context().addCookies(
        adminCookieHeader(founder)
          .split("; ")
          .map((pair) => {
            const at = pair.indexOf("=");
            return { name: pair.slice(0, at), value: pair.slice(at + 1), url: founderPage.url() };
          }),
      );
      await founderPage.goto("/internal/directory?tab=requests");
      const review = founderPage.locator(`[data-clinic-request-id="${id}"]`);
      await expect(review).toBeVisible({ timeout: 30_000 });
      await expect(review).toContainText("Clinic details");
      await expect(review).toContainText(`Clinic details ${nonce}`);
      await expect(review).toContainText(clinicName);
      await expect(review.getByTestId("clinic-request-shared")).toContainText("Shared with 1 other professional");
      await expect(review).toContainText(`→ renamed clinic ${nonce}`);
      await expect(review).toContainText(`→ ${shown(newPhone)}`);
      await expect(review).toContainText("A new name also moves the clinic’s web address; the old address forwards to it.");
      // Only what she asked about can be corrected.
      await expect(review.getByLabel(/Address to approve/)).toHaveCount(0);
      const approveName = review.getByLabel(/Name to approve/);
      await expect(approveName).toHaveValue(`renamed clinic ${nonce}`);
      await expect(async () => {
        await approveName.fill(`Renamed Clinic ${nonce}`);
        await expect(review.getByText(/Differs from what was asked/)).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await review.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(founderPage.locator(`[data-decided-clinic-request-id="${id}"]`)).toHaveCount(1, { timeout: 30_000 });
    } finally {
      await founderPage.close();
    }

    // The clinic shows the corrected name and the new phone, and its web address follows the name.
    const slugAfter = `renamed-clinic-${nonce}`;
    expect(slugBefore).not.toBe(slugAfter);
    expect(await clinicInDb()).toMatchObject({ name: `Renamed Clinic ${nonce}`, phone: newPhone, slug: slugAfter });
    const after = await requests();
    const approved = after[after.length - 1]!;
    expect(approved.status).toBe("approved");
    expect(approved.approved_details).toMatchObject({ changes: { name: `Renamed Clinic ${nonce}`, phone: newPhone } });
    expect(approved.outcome).toMatchObject({
      clinic_id: clinicId,
      changed: ["name", "phone"],
      slug: slugAfter,
      previous_slug: slugBefore,
    });

    // The old address keeps working: it forwards to the new one. The clinic page streams
    // its loading screen first, so the forward travels in the page (an instant refresh
    // that search engines read as a permanent move), not as a 308 status.
    const old = await page.request.get(`/clinics/${slugBefore}`, { maxRedirects: 0 });
    expect(old.status()).toBeLessThan(400);
    if (old.status() === 308) {
      expect(old.headers()["location"]).toContain(`/clinics/${slugAfter}`);
    } else {
      expect(await old.text()).toMatch(new RegExp(`http-equiv="refresh" content="0;url=[^"]*/clinics/${slugAfter}"`));
    }
    const visitor = await page.context().browser()!.newPage();
    try {
      await visitor.goto(`/clinics/${slugBefore}`);
      await expect(visitor).toHaveURL(new RegExp(`/clinics/${slugAfter}$`), { timeout: 30_000 });
      await expect(visitor.getByRole("heading", { level: 1 })).toContainText(`Renamed Clinic ${nonce}`, {
        timeout: 30_000,
      });
    } finally {
      await visitor.close();
    }

    await page.reload();
    const renamed = page.getByTestId("settings-clinic-card").filter({ hasText: `Renamed Clinic ${nonce}` });
    await expect(renamed.getByTestId("settings-clinic-phone")).toHaveText(shown(newPhone), { timeout: 30_000 });
    await expect(renamed.getByTestId("settings-clinic-change-pending")).toHaveCount(0);
    await expect(renamed.getByRole("button", { name: "Request a change to clinic details" })).toBeVisible();
  });
});
