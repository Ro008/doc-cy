import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { createTestDoctor, deleteTestDoctor, loginDoctorUi, type TestDoctorFixture } from "./helpers/test-doctor";

/**
 * Settings → Profile, personal mobile (user, 2026-10-09): the professional changes her
 * own mobile (a real mobile for its country, as on /register) and decides whether it
 * shows on her public profile. No founder: each change is a request_log row born
 * "recorded". Contact & phone no longer edits the mobile.
 */
test.describe("Integration: settings profile mobile", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let other: TestDoctorFixture | null = null;
  let page: Page;
  const nonce = `mob${Date.now()}`.slice(-12);
  const digits = String(Date.now()).slice(-6);
  const startMobile = `+35799${digits}`;
  const newMobile = `+35796${digits}`;
  const otherMobile = `+35797${digits}`;

  const card = () => page.getByTestId("settings-personal-mobile");
  const mobileOf = async (id: string) =>
    (await admin.from("professionals").select("mobile_number").eq("id", id).single()).data!.mobile_number;
  const showOf = async (id: string) =>
    (await admin.from("professional_settings").select("show_mobile_on_profile").eq("professional_id", id).single())
      .data!.show_mobile_on_profile;
  const records = async (type: string) =>
    (
      await admin
        .from("request_log")
        .select("status, details, before_snapshot")
        .eq("professional_id", pro!.doctorId)
        .eq("request_type", type)
        .order("created_at", { ascending: true })
    ).data ?? [];

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Mobile ${nonce}`, specialty: "Cardiology" });
    other = await createTestDoctor({ admin, nonce: `${nonce}o`, name: `Mobile other ${nonce}`, specialty: "Cardiology" });
    await admin.from("professionals").update({ mobile_number: startMobile }).eq("id", pro.doctorId);
    await admin.from("professionals").update({ mobile_number: otherMobile }).eq("id", other.doctorId);
    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    if (other) await deleteTestDoctor(other);
  });

  test("signed out, both routes answer 401", async ({ request }) => {
    expect((await request.post("/api/professional-mobile", { data: { mobile: newMobile } })).status()).toBe(401);
    expect((await request.post("/api/professional-mobile/visibility", { data: { show: true } })).status()).toBe(401);
  });

  test("Profile shows her mobile, hidden from patients by default; Contact & phone no longer edits it", async () => {
    test.setTimeout(120_000);
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(card()).toBeVisible({ timeout: 20_000 });
    await expect(card().getByLabel("Mobile number")).toHaveValue(startMobile.slice(4), { timeout: 20_000 });
    await expect(card().getByRole("switch", { name: "Show on my profile" })).toHaveAttribute("aria-checked", "false");

    await page.goto("/settings?section=contact", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("settings-clinic-phones")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#mobileNumber")).toHaveCount(0);
  });

  test("she changes her mobile: saved and recorded with the old number", async () => {
    test.setTimeout(120_000);
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const input = card().getByLabel("Mobile number");
    await expect(input).toHaveValue(startMobile.slice(4), { timeout: 20_000 });
    // Typing before hydration is wiped: retry until the form reacts.
    await expect(async () => {
      await input.fill(newMobile.slice(4));
      await expect(card().getByRole("button", { name: "Save mobile" })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await card().getByRole("button", { name: "Save mobile" }).click();
    await expect(page.getByText("Mobile saved.")).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => mobileOf(pro!.doctorId), { timeout: 10_000 }).toBe(newMobile);

    const rows = await records("professional_mobile_change");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "recorded",
      details: { mobile_number: newMobile },
      before_snapshot: { mobile_number: startMobile },
    });
    await expect(card().getByRole("button", { name: "Save mobile" })).toHaveCount(0);
  });

  test("a landline is refused in the form and by the route", async () => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const input = card().getByLabel("Mobile number");
    await expect(input).toHaveValue(newMobile.slice(4), { timeout: 20_000 });
    await expect(async () => {
      await input.fill("22123456");
      await expect(card().getByRole("button", { name: "Save mobile" })).toBeDisabled({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(card().getByText(/Enter a valid Cyprus mobile number/)).toBeVisible();

    const res = await page.request.post("/api/professional-mobile", { data: { mobile: "+35722123456" } });
    expect(res.status()).toBe(400);
    expect(await mobileOf(pro!.doctorId)).toBe(newMobile);
  });

  test("the same number changes nothing; another professional's number is refused", async () => {
    const same = await page.request.post("/api/professional-mobile", { data: { mobile: "+357 96 " + digits } });
    expect(same.status()).toBe(200);
    expect(await same.json()).toMatchObject({ changed: false, mobile: newMobile });

    // Test profiles never block anyone (the unique index skips them): look real for this check.
    const ids = [pro!.doctorId, other!.doctorId];
    await admin.from("professionals").update({ is_test_profile: false }).in("id", ids);
    try {
      const taken = await page.request.post("/api/professional-mobile", { data: { mobile: otherMobile } });
      expect(taken.status()).toBe(409);
      expect((await taken.json()).message).toContain("already used by another professional");
    } finally {
      await admin.from("professionals").update({ is_test_profile: true }).in("id", ids);
    }

    expect(await records("professional_mobile_change")).toHaveLength(1);
    expect(await mobileOf(pro!.doctorId)).toBe(newMobile);
  });

  test("the switch shows her mobile on her profile, saved at once and recorded", async () => {
    test.setTimeout(120_000);
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const toggle = card().getByRole("switch", { name: "Show on my profile" });
    await expect(toggle).toHaveAttribute("aria-checked", "false", { timeout: 20_000 });
    await expect(async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true", { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect.poll(() => showOf(pro!.doctorId), { timeout: 10_000 }).toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(card().getByRole("switch", { name: "Show on my profile" })).toHaveAttribute("aria-checked", "true", {
      timeout: 20_000,
    });
    const rows = await records("professional_mobile_visibility_change");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "recorded",
      details: { show_mobile_on_profile: true },
      before_snapshot: { show_mobile_on_profile: false },
    });

    const off = await page.request.post("/api/professional-mobile/visibility", { data: { show: false } });
    expect(off.status()).toBe(200);
    expect(await showOf(pro!.doctorId)).toBe(false);
  });

  test("the switch needs a saved mobile and a true/false value", async () => {
    expect((await page.request.post("/api/professional-mobile/visibility", { data: { show: "yes" } })).status()).toBe(400);
    await admin.from("professionals").update({ mobile_number: null }).eq("id", pro!.doctorId);
    const res = await page.request.post("/api/professional-mobile/visibility", { data: { show: true } });
    expect(res.status()).toBe(409);
    expect(await showOf(pro!.doctorId)).toBe(false);
  });
});
