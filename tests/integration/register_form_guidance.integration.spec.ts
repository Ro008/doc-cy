import { expect, test } from "@playwright/test";
import { gotoRegisterPracticeStep } from "./helpers/goto-register-practice-step";

/**
 * Beta testers were skipping fields and could not tell why the form refused to
 * submit: the jump-to-first-missing-field call landed on a hidden input, so the
 * page never moved. These cover the guidance that replaced it.
 */
test.describe("Integration UI: register form guidance", { tag: "@pr-e2e" }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByTestId("register-wizard-continue")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("register-step-1")).toBeVisible();
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
    await expect(progress).toContainText("Step 1 of 3");
  });

  test("shows progress for the account step once opened", async ({ page }) => {
    const progress = page.getByTestId("register-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toContainText("Step 1 of 3");
    await expect(progress).toContainText("Account");

    await page.locator("#register-first-name").fill("Karina");
    await expect(
      page.locator("[data-field-key='firstName'][data-complete='1']"),
    ).toHaveCount(1);
  });

  test("lists what is missing on this step and jumps to the field when asked", async ({
    page,
  }) => {
    await expect(page.getByTestId("register-missing-summary")).toBeHidden();

    await page.locator("#register-first-name").fill("Karina");
    await page.getByTestId("register-wizard-continue").click();

    const summary = page.getByTestId("register-missing-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("4 things left before you can continue");
    await expect(summary.getByRole("button", { name: "Last name" })).toBeVisible();

    await summary.getByRole("button", { name: "Email address" }).click();
    await expect(page.locator("#register-form input[name='email']")).toBeFocused();
  });

  test("ticks items off the list instead of dropping them", async ({ page }) => {
    await page.getByTestId("register-wizard-continue").click();

    const summary = page.getByTestId("register-missing-summary");
    await expect(summary).toContainText("5 things left before you can continue");
    await expect(summary.locator("li")).toHaveCount(5);

    await page.locator("input[name='phone']").fill("+35799123456");

    await expect(summary).toContainText("4 things left before you can continue");
    // The row stays put, struck through, so the list never shifts under the user.
    await expect(summary.locator("li")).toHaveCount(5);
    await expect(summary.locator("li", { hasText: "Mobile number" }).locator("s, .line-through"))
      .toHaveCount(1);
  });

  test("continuing an empty step reveals the first missing field", async ({ page }) => {
    await page.getByTestId("register-wizard-continue").click();

    await expect(page.locator("#register-first-name")).toBeFocused();
    await expect(
      page.locator("[data-field-key='firstName'][data-invalid='1']"),
    ).toHaveCount(1);
    await expect(page).toHaveURL(/\/register\/?$/);
  });

  test("a finished step collapses to a summary and Edit reopens it", async ({ page }) => {
    await page.locator("#register-first-name").fill("Karina");
    await page.locator("#register-last-name").fill("Mino");
    await page.locator("#register-form input[name='email']").fill("karina.mino@example.com");
    await page.locator("#register-form input[name='password']").fill("StrongPass123!");
    await page.locator("#register-form input[name='phone']").fill("+35799123456");
    await expect(page.getByTestId("register-wizard-continue")).toHaveText(/Continue to profile/i);
    await page.getByTestId("register-wizard-continue").click();

    await expect(page.getByTestId("register-step-2")).toBeVisible();
    await expect(page.getByTestId("register-step-1")).toBeHidden();
    const accountCard = page.locator("[data-register-step-card='1']");
    await expect(accountCard).toContainText("Karina Mino · karina.mino@example.com");
    await expect(page.getByTestId("register-wizard-continue")).toHaveText(/Continue to practice/i);

    await accountCard.getByRole("button", { name: /Edit/i }).click();
    await expect(page.getByTestId("register-step-1")).toBeVisible();
    await expect(page.locator("#register-first-name")).toHaveValue("Karina");
  });

  test("benefits showcase and FAQ stay on the page", async ({ page }) => {
    const showcase = page.getByTestId("register-showcase");
    await expect(showcase).toBeVisible();
    await expect(showcase.getByText(/You approve in one click/i)).toBeVisible();
    await showcase.getByRole("button", { name: "Next benefit" }).click();
    await expect(showcase.getByText(/Your profile is your new website/i)).toBeVisible();
    await expect(page.getByText(/synced|synchroni[sz]ation/i)).toHaveCount(0);

    const faq = page.getByTestId("register-faq");
    await faq.getByText("Can I see bookings in my own calendar?").click();
    await expect(faq.getByText(/Google Calendar or Apple \/ Outlook/)).toBeVisible();
  });

  test("on desktop the form and the benefits fit in one screen, no scrolling", async ({
    page,
  }, testInfo) => {
    testInfo.skip(!testInfo.project.name.startsWith("Desktop"), "Desktop layout only.");

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/register");
      await expect(page.getByTestId("register-wizard-continue")).toBeVisible({ timeout: 20_000 });
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      const withinFold = async (name: string, locator: ReturnType<typeof page.locator>) => {
        const box = await locator.boundingBox();
        expect(box, `${name} is rendered`).not.toBeNull();
        expect(box!.y, `${name} top at ${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(0);
        expect(
          box!.y + box!.height,
          `${name} bottom at ${viewport.width}x${viewport.height}`,
        ).toBeLessThanOrEqual(viewport.height);
      };

      await withinFold("Continue button", page.getByTestId("register-wizard-continue"));
      await withinFold("Practice step card", page.locator("[data-register-step-card='3']"));
      await withinFold("Price ticket", page.getByTestId("register-plan-ticket-row"));
      await withinFold(
        "Next benefit button",
        page.getByTestId("register-showcase").getByRole("button", { name: "Next benefit" }),
      );
    }
  });

  test("on desktop the practice step also fits without scrolling", async ({ page }, testInfo) => {
    testInfo.skip(!testInfo.project.name.startsWith("Desktop"), "Desktop layout only.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/register");
    await gotoRegisterPracticeStep(page);

    // Moving between steps must not scroll the page when the card already fits.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const submit = page.getByRole("button", { name: /Submit my application/i });
    const box = await submit.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  });

  test("submitted screen asks them to confirm email with a link, not a code", async ({ page }) => {
    await page.goto("/register?submitted=1");
    await expect(
      page.getByRole("heading", { name: /confirm your email to continue/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/one click,\s+not a code/i)).toBeVisible();
    await expect(page.getByText(/6-digit|verification code/i)).toHaveCount(0);

    await page.goto("/register?submitted=1&email=confirmed");
    await expect(
      page.getByRole("heading", { name: /your profile is under review/i }),
    ).toBeVisible();
    await expect(page.getByText(/EMAIL CONFIRMED/i)).toBeVisible();
  });
});
