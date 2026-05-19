import { expect, test } from "@playwright/test";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

test.describe("Promote your practice (settings)", () => {
  test.beforeEach(async ({ page }) => {
    const email = normalizeSecret(process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "");
    const password = normalizeSecret(
      process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? ""
    );
    test.skip(!email || !password, "Missing test doctor credentials.");

    await signInDoctorAndSetCookies(page, undefined, { email, password });
    await page.goto("/agenda/settings#promote-practice", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda\/settings(?:#promote-practice)?/, { timeout: 20_000 });
  });

  test("verified doctor sees QR block and phone/website scripts", async ({ page }) => {
    test.setTimeout(120_000);

    await expect(page.getByRole("heading", { name: "Promote your practice" })).toBeVisible();
    await expect(page.getByText("Phone and website scripts")).toBeVisible();
    await expect(page.getByTestId("promote-voicemail-script")).toBeVisible();
    await expect(page.getByTestId("promote-reception-script")).toBeVisible();
    await expect(page.getByTestId("promote-website-script")).toBeVisible();

    await expect(page.getByRole("button", { name: "Print booking sign" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download QR (PNG)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy text" }).first()).toBeVisible();

    await expect(page.getByText(/Quick access:/i)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Promote your practice, booking QR/i })
    ).toHaveCount(0);
  });

  test("website Contact Support opens feedback with locked topic and prefilled message", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const websiteBlock = page.getByTestId("promote-website-script");
    await websiteBlock.scrollIntoViewIfNeeded();
    await websiteBlock.getByRole("button", { name: "Contact Support" }).click();

    const dialog = page.getByRole("dialog", { name: /How can we help you/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText("Help with website booking button")).toBeVisible();

    const message = dialog.getByRole("textbox", { name: /message/i });
    await expect(message).toHaveValue(/booking page|σύνδεσμος κρατήσεων/i);
    await expect(message).toHaveValue(/DocCy/i);
  });

  test("mobile settings tab reaches promote scripts section", async ({ page }) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });

    await page.getByTestId("userbar-tab-settings").click();
    await expect(page).toHaveURL(/\/agenda\/settings(?:[/?#]|$)/, { timeout: 15_000 });
    await expect(page.getByTestId("promote-voicemail-script")).toBeVisible();
  });
});
