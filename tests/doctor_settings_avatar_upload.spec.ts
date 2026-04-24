import path from "node:path";
import { test, expect } from "@playwright/test";

test.describe("Doctor settings avatar upload", () => {
  test("doctor can upload avatar from settings crop flow", async ({ page }) => {
    test.setTimeout(120_000);
    const email = (process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "").trim();
    const password = (process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "").trim();

    test.skip(!email || !password, "Missing TEST_USER_* or TEST_DOCTOR_* credentials.");

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Sign in/i }).click();

    try {
      await page.waitForURL(/\/agenda(?:[/?#]|$)/, { timeout: 30_000 });
    } catch {
      await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    }
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 30_000 });

    await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda\/settings(?:[/?#]|$)/, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Save settings/i })).toBeVisible({
      timeout: 20_000,
    });

    const fixturePath = path.join(process.cwd(), "tests", "fixtures", "e2e-person-avatar.jpg");
    await page.getByTestId("settings-avatar-file-input").setInputFiles(fixturePath);

    const confirmCropButton = page.getByRole("button", { name: /Confirm crop/i });
    await expect(confirmCropButton).toBeVisible({ timeout: 10_000 });
    const uploadResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/doctor-avatar") && res.request().method() === "POST"
    );
    await confirmCropButton.click();

    const uploadResponse = await uploadResponsePromise;
    const uploadPayload = await uploadResponse.json().catch(() => ({}));
    expect(
      uploadResponse.ok(),
      `Avatar upload failed with ${uploadResponse.status()}: ${JSON.stringify(uploadPayload)}`
    ).toBeTruthy();

    await expect(page.getByText(/Profile photo updated\./i)).toBeVisible({ timeout: 20_000 });
  });
});
