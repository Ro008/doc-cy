import { expect, test } from "@playwright/test";
import { signInDoctorOrSkipOnInfraError } from "./helpers/signInDoctorWithInfraSkip";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

test.describe("Doctor settings language guard", { tag: "@pr-e2e" }, () => {
  test("settings stays English even if NEXT_LOCALE cookie is Greek", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    const email = normalizeSecret(process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "");
    const password = normalizeSecret(
      process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? ""
    );

    const effectiveBaseUrl = baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
    const parsed = new URL(effectiveBaseUrl);
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "el",
        domain: parsed.hostname,
        path: "/",
        secure: parsed.protocol === "https:",
        sameSite: "Lax",
      },
    ]);

    await signInDoctorOrSkipOnInfraError(page, undefined, { email, password });
    await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });

    await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda\/settings(?:[/?#]|$)/, { timeout: 20_000 });

    // No language switcher exists here yet; this page should stay in English.
    await expect(page.getByText(/^Settings$/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Save settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Promote your practice" })).toBeVisible();
    await expect(page.getByText("Patients scan to open")).toBeVisible();
    await expect(page.getByText("Phone and website scripts")).toBeVisible();
    await expect(page.getByTestId("promote-voicemail-script")).toBeVisible();

    await expect(page.getByText("Προωθήστε το ιατρείο σας")).toHaveCount(0);
    await expect(page.getByText("Οι ασθενείς σκανάρουν για να ανοίξουν")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Εκτύπωση πινακίδας κράτησης" })).toHaveCount(0);
  });
});
