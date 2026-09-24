import { expect, test, type Page } from "@playwright/test";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  gotoRegisterPracticeStep,
  selectRegisterEnglishLanguage,
  uploadRegisterAvatar,
  waitForRegisterWizardReady,
} from "./helpers/goto-register-practice-step";
import { INTEGRATION_DOCTOR_PASSWORD } from "./helpers/test-doctor";

const PUBLIC_CLINIC_FIELDS = [
  "address",
  "district",
  "id",
  "latitude",
  "longitude",
  "name",
  "placeId",
  "professionalCount",
  "town",
];

/** Pick the first DocCy suggestion for `query` in clinic row `index`. */
async function chooseDocCyClinic(
  page: Page,
  index: number,
  query: string,
  nth = 0,
): Promise<string> {
  const input = page.getByTestId(`register-clinic-search-${index}`);
  await input.fill(query);
  const option = page.getByTestId(`register-clinic-search-${index}-option`).nth(nth);
  await expect(option).toBeVisible({ timeout: 15_000 });
  const name = (await option.getAttribute("data-clinic-name")) ?? "";
  await option.click();
  return name;
}

test.describe("Integration UI: register clinics", { tag: "@pr-e2e" }, () => {
  test("clinic search API returns public fields only, and nothing for one letter", async ({
    request,
  }) => {
    const short = await request.get("/api/register/clinic-search?q=a");
    expect(short.status()).toBe(200);
    expect((await short.json()).results).toEqual([]);

    const res = await request.get("/api/register/clinic-search?q=lefkotheou");
    expect(res.status()).toBe(200);
    const { results } = (await res.json()) as { results: Record<string, unknown>[] };
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);
    for (const row of results) {
      expect(Object.keys(row).sort()).toEqual(PUBLIC_CLINIC_FIELDS);
      expect(String(row.address)).toMatch(/lefkotheou/i);
    }
  });

  test("a new professional finds their clinic in DocCy, with Google as a fallback", async ({
    page,
  }) => {
    await page.goto("/register");
    await gotoRegisterPracticeStep(page);

    const row = page.locator("[data-clinic-row='0']");
    const name = await chooseDocCyClinic(page, 0, "lefkotheou");
    const summary = row.getByTestId("clinic-location-saved-summary");
    await expect(summary).toContainText(name);
    await expect(summary).toContainText(/Lefkotheou/i);
    await expect(summary).toContainText(/From DocCy/i);
    await expect(page.locator("#register-form input[name='clinicId']")).not.toHaveValue("");
    await expect(page.locator("[data-field-key='clinic']")).toHaveAttribute("data-complete", "1");

    // A DocCy clinic already has its location and name: nothing to edit but the choice.
    await expect(summary.getByRole("button", { name: "Adjust pin on map" })).toHaveCount(0);
    await expect(summary.getByRole("button", { name: "Add map pin" })).toHaveCount(0);
    await expect(summary.getByLabel("Clinic name")).toHaveCount(0);

    // Changing clinic can fall back to Google Maps.
    await summary.getByRole("button", { name: /Change clinic/i }).click();
    await page.getByRole("button", { name: /Search Google Maps/i }).click();
    await expect(page.locator("#register-clinic-address")).toBeVisible();
    await expect(page.locator("#register-form input[name='clinicId']")).toHaveValue("");
  });

  test("every professional can add up to five clinics, one open at a time", async ({ page }) => {
    await page.goto("/register");
    await gotoRegisterPracticeStep(page);

    const firstName = await chooseDocCyClinic(page, 0, "lefkotheou");
    const add = page.getByRole("button", { name: /Add another clinic/i });
    await add.click();

    // The new row opens and the first one folds into a one-line summary.
    await expect(page.getByTestId("register-clinic-search-1")).toBeVisible();
    await expect(page.getByTestId("register-clinic-search-0")).toBeHidden();
    await expect(page.locator("[data-clinic-row='0'] [data-clinic-row-toggle]")).toContainText(
      firstName,
    );

    // An empty extra clinic blocks the submit and is named in the list.
    await page.getByRole("button", { name: /Submit my application/i }).click();
    const summaryList = page.getByTestId("register-missing-summary");
    await expect(summaryList.getByRole("button", { name: "Clinic 2 address" })).toBeVisible();

    // Reopening the first row folds the second.
    await page.locator("[data-clinic-row='0'] [data-clinic-row-toggle]").click();
    await expect(page.getByTestId("register-clinic-search-1")).toBeHidden();

    // Jumping to the missing clinic from the list opens its row again.
    await summaryList.getByRole("button", { name: "Clinic 2 address" }).click();
    await expect(page.getByTestId("register-clinic-search-1")).toBeVisible();

    // One at a time: the empty Clinic 2 must be set before Clinic 3.
    await expect(add).toBeDisabled();
    await chooseDocCyClinic(page, 1, "polykliniki");
    for (let i = 2; i < 5; i += 1) {
      await add.click();
      await chooseDocCyClinic(page, i, "clinic", i);
    }
    await expect(page.locator("[data-clinic-row]")).toHaveCount(5);
    await expect(add).toHaveCount(0);

    // Removing a clinic keeps the posted fields contiguous (the server stops at a gap).
    await page.locator("[data-clinic-row='1']").getByRole("button", { name: /Remove clinic 2/i }).click();
    await expect(page.locator("[data-clinic-row]")).toHaveCount(4);
    await expect(page.locator("#register-form input[name='clinic1Address']")).toHaveCount(1);
    await expect(page.locator("#register-form input[name='clinic4Address']")).toHaveCount(0);
  });

  test("a claim with several clinics shows them as rows, the first one open", async ({ page }) => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const links: { professional_id: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await admin
        .from("professional_clinics")
        .select("professional_id")
        .range(from, from + 999);
      links.push(...((data ?? []) as { professional_id: string }[]));
      if ((data ?? []).length < 1000) break;
    }
    const counts = new Map<string, number>();
    for (const link of links) counts.set(link.professional_id, (counts.get(link.professional_id) ?? 0) + 1);
    const multi = [...counts.entries()].filter(([, n]) => n >= 2).map(([id]) => id);
    const { data: listing } = await admin
      .from("professionals")
      .select("id")
      .in("id", multi.slice(0, 300))
      .eq("is_registered", false)
      .eq("is_archived", false)
      .limit(1)
      .single();
    const claimId = (listing as { id: string }).id;

    await page.goto(`/register?claim=${claimId}`);
    await waitForRegisterWizardReady(page);
    await page.locator("#register-form input[name='email']").fill("claim.clinics@example.com");
    await page.locator("#register-form input[name='password']").fill(INTEGRATION_DOCTOR_PASSWORD);
    await page.getByTestId("register-phone-input").fill("+35799123456");
    const gesyYes = page.getByRole("radiogroup", { name: /GeSY/ }).getByText("Yes", { exact: true });
    await gesyYes.click();
    const gender = page.getByRole("radiogroup", { name: "Gender" });
    if ((await gender.locator("input:checked").count()) === 0) {
      await gender.getByText("Female", { exact: true }).click();
    }
    await page.getByTestId("register-wizard-continue").click();
    await uploadRegisterAvatar(page);
    await selectRegisterEnglishLanguage(page);
    await page.getByTestId("register-wizard-continue").click();

    const rows = page.locator("[data-clinic-row]");
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
    await expect(rows.nth(0).getByTestId("clinic-location-saved-summary")).toBeVisible();
    await expect(rows.nth(1).getByTestId("clinic-location-saved-summary")).toBeHidden();

    await rows.nth(1).locator("[data-clinic-row-toggle]").click();
    await expect(rows.nth(1).getByTestId("clinic-location-saved-summary")).toBeVisible();
    await expect(rows.nth(0).getByTestId("clinic-location-saved-summary")).toBeHidden();
  });
});
