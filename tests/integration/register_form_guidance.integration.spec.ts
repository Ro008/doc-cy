import { expect, test } from "@playwright/test";

/**
 * Beta testers were skipping fields and could not tell why the form refused to
 * submit: the jump-to-first-missing-field call landed on a hidden input, so the
 * page never moved. These cover the guidance that replaced it.
 */
test.describe("Integration UI: register form guidance", { tag: "@pr-e2e" }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByTestId("register-specialty-trigger")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("requires a strong password before counting the field as done", async ({ page }) => {
    const progress = page.getByTestId("register-progress");
    await expect(
      page.getByText(
        "Use at least 8 characters, including uppercase, lowercase, a number, and a special character.",
      ),
    ).toBeVisible();

    const passwordField = page.locator("[data-field-key='password']");
    await page.locator("#register-form input[name='password']").fill("password");
    await expect(passwordField).toHaveAttribute("data-complete", "0");

    await page.locator("#register-form input[name='password']").fill("StrongPass123!");
    await expect(passwordField).toHaveAttribute("data-complete", "1");
    await expect(progress).toContainText("1 of 9 completed");
  });

  test("shows progress and counts a field as done once filled", async ({ page }) => {
    const progress = page.getByTestId("register-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toContainText("0 of 9 completed");
    await expect(progress).toContainText("Full name");

    await page.locator("#register-full-name").fill("Karina Mino");
    await expect(progress).toContainText("1 of 9 completed");

    await expect(
      page.locator("[data-field-key='fullName'][data-complete='1']"),
    ).toHaveCount(1);
  });

  test("lists what is missing and jumps to the field when asked", async ({ page }) => {
    await expect(page.getByTestId("register-missing-summary")).toBeHidden();

    await page.locator("#register-full-name").fill("Karina Mino");
    await page.getByRole("button", { name: /Submit My Application/i }).click();

    const summary = page.getByTestId("register-missing-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("8 things left before you can submit");
    await expect(
      summary.getByRole("button", { name: "Specialties and license numbers" }),
    ).toBeVisible();

    // The old code focused a hidden input here, so nothing happened at all.
    await summary.getByRole("button", { name: "Languages you speak" }).click();
    await expect(page.getByTestId("language-multiselect-trigger")).toBeFocused();
  });

  test("ticks items off the list instead of dropping them", async ({ page }) => {
    await page.getByRole("button", { name: /Submit My Application/i }).click();

    const summary = page.getByTestId("register-missing-summary");
    await expect(summary).toContainText("9 things left before you can submit");
    await expect(summary.locator("li")).toHaveCount(9);

    await page.locator("input[name='phone']").fill("+35799123456");

    await expect(summary).toContainText("8 things left before you can submit");
    // The row stays put, struck through, so the list never shifts under the user.
    await expect(summary.locator("li")).toHaveCount(9);
    await expect(summary.locator("li", { hasText: "WhatsApp number" }).locator("s, .line-through"))
      .toHaveCount(1);
  });

  test("submitting an empty form reveals the first missing field", async ({ page }) => {
    await page.getByRole("button", { name: /Submit My Application/i }).click();

    await expect(page.locator("#register-full-name")).toBeFocused();
    await expect(
      page.locator("[data-field-key='fullName'][data-invalid='1']"),
    ).toHaveCount(1);
    await expect(page).toHaveURL(/\/register\/?$/);
  });
});
