import path from "node:path";
import { test, expect } from "@playwright/test";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";

/**
 * A new photo needs a founder (user, 2026-10-10): the crop flow sends a request, the
 * card says it waits for approval, and she can withdraw it (which this test does, so
 * the shared account is left as it was).
 */
test.describe("Doctor settings avatar upload", () => {
  test("doctor can send a new photo for approval from the settings crop flow", async ({ page }) => {
    test.setTimeout(120_000);
    const email = (process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "").trim();
    const password = (process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "").trim();

    test.skip(!email || !password, "Missing TEST_USER_* or TEST_DOCTOR_* credentials.");

    // Programmatic session (as the other settings specs): the login form now ends with
    // an emailed sign-in step and its password field shares the "Password" label.
    await signInDoctorAndSetCookies(page, undefined, { email, password });

    await page.goto("/settings?section=profile", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/settings(?:[/?#]|$)/, { timeout: 20_000 });
    // A request left by an earlier run: withdraw it first.
    const pending = page.getByTestId("settings-photo-change-pending");
    await expect(page.getByTestId("settings-photo-controls")).toBeVisible({ timeout: 20_000 });
    if (await pending.isVisible()) {
      await pending.getByRole("button", { name: "Withdraw request" }).click();
      await expect(pending).toHaveCount(0, { timeout: 20_000 });
    }
    await expect(page.getByRole("button", { name: /Upload new photo/i })).toBeVisible({
      timeout: 20_000,
    });

    const fixturePath = path.join(process.cwd(), "tests", "fixtures", "e2e-person-avatar.jpg");
    // Before the page is interactive the picked file is ignored: pick it until the crop opens.
    const confirmCropButton = page.getByRole("button", { name: /Confirm crop/i });
    await expect(async () => {
      await page.getByTestId("settings-avatar-file-input").setInputFiles(fixturePath);
      await expect(confirmCropButton).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    const uploadResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/photo-change-requests") && res.request().method() === "POST"
    );
    await confirmCropButton.click();

    const uploadResponse = await uploadResponsePromise;
    const uploadPayload = await uploadResponse.json().catch(() => ({}));
    expect(
      uploadResponse.ok(),
      `Avatar upload failed with ${uploadResponse.status()}: ${JSON.stringify(uploadPayload)}`
    ).toBeTruthy();

    await expect(pending).toContainText("waiting for DocCy’s approval", { timeout: 20_000 });
    await pending.getByRole("button", { name: "Withdraw request" }).click();
    await expect(pending).toHaveCount(0, { timeout: 20_000 });
  });
});
