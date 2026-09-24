import fs from "node:fs";
import { expect, test } from "@playwright/test";
import {
  REGISTER_AVATAR_FIXTURE,
  REGISTER_SMALL_AVATAR_FIXTURE,
  answerRegisterAccountChoices,
  gotoRegisterPracticeStep,
  gotoRegisterProfileStep,
  waitForRegisterWizardReady,
} from "./helpers/goto-register-practice-step";

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
    await waitForRegisterWizardReady(page);
  });

  test("requires a strong password before counting the field as done", async ({ page }) => {
    const progress = page.getByTestId("register-progress");
    const rules = page.getByTestId("register-password-rules");
    await expect(rules).toBeVisible();
    const rule = (key: string) => rules.locator(`[data-rule='${key}']`);

    const passwordField = page.locator("[data-field-key='password']");
    await page.locator("#register-form input[name='password']").fill("password");
    await expect(passwordField).toHaveAttribute("data-complete", "0");
    // The checklist says exactly what is still missing.
    await expect(rule("length")).toHaveAttribute("data-met", "1");
    await expect(rule("lower")).toHaveAttribute("data-met", "1");
    await expect(rule("upper")).toHaveAttribute("data-met", "0");
    await expect(rule("number")).toHaveAttribute("data-met", "0");
    await expect(rule("symbol")).toHaveAttribute("data-met", "0");

    await page.locator("#register-form input[name='password']").fill("StrongPass123!");
    await expect(passwordField).toHaveAttribute("data-complete", "1");
    await expect(rules.locator("[data-met='0']")).toHaveCount(0);
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
    await expect(summary).toContainText("6 things left before you can continue");
    await expect(summary.getByRole("button", { name: "Last name" })).toBeVisible();

    await summary.getByRole("button", { name: "Email address" }).click();
    await expect(page.locator("#register-form input[name='email']")).toBeFocused();
  });

  test("ticks items off the list instead of dropping them", async ({ page }) => {
    await page.getByTestId("register-wizard-continue").click();

    const summary = page.getByTestId("register-missing-summary");
    await expect(summary).toContainText("7 things left before you can continue");
    await expect(summary.locator("li")).toHaveCount(7);

    await page.getByTestId("register-phone-input").fill("+35799123456");

    await expect(summary).toContainText("6 things left before you can continue");
    // The row stays put, struck through, so the list never shifts under the user.
    await expect(summary.locator("li")).toHaveCount(7);
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

  test("email needs a real domain before it counts as done", async ({ page }) => {
    const field = page.locator("[data-field-key='email']");
    const email = page.locator("#register-form input[name='email']");

    await email.fill("sdfgdfg@a");
    await expect(field).toHaveAttribute("data-complete", "0");
    await page.getByTestId("register-wizard-continue").click();
    await expect(
      page.getByTestId("register-missing-summary").getByRole("button", { name: "Email address" }),
    ).toBeVisible();
    await expect(field.getByText(/valid email/i)).toBeVisible();

    await email.fill("maria@practice.com");
    await expect(field).toHaveAttribute("data-complete", "1");
  });

  test("hydrates without a server/client mismatch (it re-renders the form and wipes input)", async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/hydrat|did not match|server-rendered/i.test(text)) hydrationErrors.push(text);
    });
    page.on("pageerror", (error) => {
      if (/hydrat|did not match|server-rendered/i.test(error.message)) {
        hydrationErrors.push(error.message);
      }
    });
    await page.reload();
    await waitForRegisterWizardReady(page);
    await expect(page.getByTestId("register-phone-country").locator("option")).not.toHaveCount(1);
    expect(hydrationErrors).toEqual([]);
  });

  test("names need letters, not just spaces or numbers", async ({ page }) => {
    const field = page.locator("[data-field-key='firstName']");
    const input = page.locator("#register-first-name");
    for (const bad of ["   ", "123", "Maria2"]) {
      await input.fill(bad);
      await expect(field, JSON.stringify(bad)).toHaveAttribute("data-complete", "0");
    }
    await page.getByTestId("register-wizard-continue").click();
    await expect(field.getByText(/letters only/i)).toBeVisible();

    await input.fill("Anne-Marie");
    await expect(field).toHaveAttribute("data-complete", "1");
  });

  test("suggests a fix for a mistyped email provider", async ({ page }) => {
    const email = page.locator("#register-form input[name='email']");
    await email.fill("maria@gmial.com");
    await email.blur();

    const suggestion = page.getByTestId("register-email-suggestion");
    await expect(suggestion).toContainText("Did you mean");
    await suggestion.getByRole("button", { name: "maria@gmail.com" }).click();
    await expect(email).toHaveValue("maria@gmail.com");
    await expect(suggestion).toBeHidden();
    await expect(page.locator("[data-field-key='email']")).toHaveAttribute("data-complete", "1");
  });

  test("mobile number is checked against the chosen country code", async ({ page }) => {
    const field = page.locator("[data-field-key='phone']");
    const country = page.getByTestId("register-phone-country");
    const number = page.getByTestId("register-phone-input");
    await expect(country).toHaveValue("CY");

    await country.selectOption("ES");
    await expect(number).toHaveAttribute("placeholder", /^612 34 56 78$/);
    // Right length for Spain, wrong pattern: Spanish mobiles start with 6 or 7.
    await number.fill("123456789");
    await expect(field).toHaveAttribute("data-complete", "0");
    await page.getByTestId("register-wizard-continue").click();
    await expect(
      page.getByTestId("register-missing-summary").getByRole("button", { name: "Mobile number" }),
    ).toBeVisible();
    await expect(field.getByText(/valid Spain mobile number/i)).toBeVisible();

    await number.fill("667000000");
    await expect(field).toHaveAttribute("data-complete", "1");
    await expect(page.locator("#register-form input[name='phone']")).toHaveValue("+34667000000");

    // Pasting a full international number picks the country for them.
    await number.fill("+35799123456");
    await expect(country).toHaveValue("CY");
    await expect(field).toHaveAttribute("data-complete", "1");
    await expect(page.locator("#register-form input[name='phone']")).toHaveValue("+35799123456");
  });

  test("gender and GeSY are required on the account step", async ({ page }) => {
    await page.locator("#register-first-name").fill("Karina");
    await page.locator("#register-last-name").fill("Mino");
    await page.locator("#register-form input[name='email']").fill("karina.mino@example.com");
    await page.locator("#register-form input[name='password']").fill("StrongPass123!");
    await page.getByTestId("register-phone-input").fill("+35799123456");
    await page.getByTestId("register-wizard-continue").click();

    const summary = page.getByTestId("register-missing-summary");
    await expect(summary).toContainText("2 things left before you can continue");
    await expect(summary.getByRole("button", { name: "Gender" })).toBeVisible();
    await expect(summary.getByRole("button", { name: "GeSY" })).toBeVisible();
    await expect(page.getByTestId("register-step-1")).toBeVisible();

    const gender = page.getByRole("radiogroup", { name: "Gender" });
    await expect(gender.getByRole("radio")).toHaveCount(2);
    await expect(gender.getByRole("radio", { name: "Male", exact: true })).toBeAttached();
    await expect(gender.getByRole("radio", { name: "Female" })).toBeAttached();
    const gesy = page.getByRole("radiogroup", { name: /GeSY/ });
    await expect(gesy.getByRole("radio", { name: "Yes" })).toBeAttached();
    await expect(gesy.getByRole("radio", { name: "No" })).toBeAttached();

    await answerRegisterAccountChoices(page, { gender: "Male", gesy: "No" });
    await expect(gender.getByRole("radio", { name: "Male", exact: true })).toBeChecked();
    await expect(gesy.getByRole("radio", { name: "No" })).toBeChecked();
    await page.getByTestId("register-wizard-continue").click();
    await expect(page.getByTestId("register-step-2")).toBeVisible();
  });

  test("a finished step collapses to a summary and Edit reopens it", async ({ page }) => {
    await page.locator("#register-first-name").fill("Karina");
    await page.locator("#register-last-name").fill("Mino");
    await page.locator("#register-form input[name='email']").fill("karina.mino@example.com");
    await page.locator("#register-form input[name='password']").fill("StrongPass123!");
    await page.getByTestId("register-phone-input").fill("+35799123456");
    await answerRegisterAccountChoices(page);
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
      await waitForRegisterWizardReady(page);
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

  test("languages are one-click pills, with more on demand", async ({ page }) => {
    await gotoRegisterProfileStep(page);
    await expect(page.getByTestId("language-multiselect-trigger")).toHaveCount(0);

    const greek = page.getByTestId("language-option-Greek");
    await expect(greek).toBeVisible();
    await greek.click();
    await expect(greek.getByRole("checkbox")).toBeChecked();
    await expect(page.locator("[data-field-key='languages']")).toHaveAttribute("data-complete", "1");

    const german = page.getByTestId("language-option-German");
    await expect(german).toHaveCount(0);
    await page.getByRole("button", { name: /More languages/i }).click();
    await german.click();
    await page.getByRole("button", { name: /Fewer languages/i }).click();
    // A language they picked stays visible when the list collapses.
    await expect(german.getByRole("checkbox")).toBeChecked();

    await greek.click();
    await expect(greek.getByRole("checkbox")).not.toBeChecked();
  });

  test("a photo below 400×400 is refused with its size", async ({ page }) => {
    await gotoRegisterProfileStep(page);
    await page.getByTestId("register-avatar-file-input").setInputFiles(REGISTER_SMALL_AVATAR_FIXTURE);
    await expect(page.getByTestId("register-avatar-error")).toContainText("128×128");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("an iPhone HEIC photo gets a specific message", async ({ page }) => {
    await gotoRegisterProfileStep(page);
    await page.getByTestId("register-avatar-file-input").setInputFiles({
      name: "IMG_0001.HEIC",
      mimeType: "image/heic",
      buffer: Buffer.from("not really a heic"),
    });
    await expect(page.getByTestId("register-avatar-error")).toContainText(/HEIC/);
    await expect(page.getByTestId("register-avatar-error")).toContainText(/JPG/);
  });

  test("the crop dialog keeps focus inside and closes with Escape", async ({ page }) => {
    await gotoRegisterProfileStep(page);
    await page.getByTestId("register-avatar-file-input").setInputFiles(REGISTER_AVATAR_FIXTURE);
    const dialog = page.getByRole("dialog", { name: /Crop your photo/i });
    await expect(dialog).toBeVisible();

    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
        `focus stays in the dialog after ${i + 1} Tab`,
      ).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("register-avatar-error")).toContainText(/No photo yet/i);
  });

  test("a photo can be dragged onto the upload area", async ({ page }) => {
    await gotoRegisterProfileStep(page);
    const bytes = fs.readFileSync(REGISTER_AVATAR_FIXTURE).toString("base64");
    const dataTransfer = await page.evaluateHandle((b64) => {
      const binary = atob(b64);
      const data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) data[i] = binary.charCodeAt(i);
      const transfer = new DataTransfer();
      transfer.items.add(new File([data], "me.jpg", { type: "image/jpeg" }));
      return transfer;
    }, bytes);
    await page.getByTestId("register-avatar-dropzone").dispatchEvent("drop", { dataTransfer });

    await page.getByRole("button", { name: /Confirm crop/i }).click();
    await expect(page.getByTestId("register-avatar-ready")).toBeVisible();
    await expect(page.locator("[data-field-key='photo']")).toHaveAttribute("data-complete", "1");
    await expect(page.getByRole("button", { name: /Change photo/i })).toBeVisible();
  });

  test("specialty and licence sit side by side, labelled and aligned", async ({ page }, testInfo) => {
    testInfo.skip(!testInfo.project.name.startsWith("Desktop"), "Side-by-side layout is desktop.");
    await gotoRegisterPracticeStep(page);

    const trigger = page.getByRole("button", { name: /^Specialty/ });
    const licence = page.getByTestId("register-license-0");
    await expect(trigger).toBeVisible();
    // A visible label, same as the licence field next to it.
    await expect(page.locator("label[for='register-specialty-trigger']")).toBeVisible();

    // Measure once the step's entrance animation has settled.
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== "running"),
    );
    const a = (await trigger.boundingBox())!;
    const b = (await licence.boundingBox())!;
    expect(Math.abs(a.y - b.y), "tops line up").toBeLessThanOrEqual(1);
    expect(Math.abs(a.height - b.height), "same height").toBeLessThanOrEqual(1);
  });

  test("one specialty has one label; the group title comes with the second", async ({ page }) => {
    await gotoRegisterPracticeStep(page);
    const groupTitle = page.getByTestId("register-specialties-title");
    await expect(groupTitle).toHaveCount(0);
    await expect(page.locator("label[for='register-specialty-trigger']")).toBeVisible();

    await page.getByRole("button", { name: /Add another specialty/i }).click();
    await expect(groupTitle).toBeVisible();
  });

  test("the licence number needs 3 characters and a digit", async ({ page }) => {
    await gotoRegisterPracticeStep(page);
    await page.getByTestId("register-specialty-trigger").click();
    await page.getByRole("button", { name: "Cardiology", exact: true }).click();

    const specialties = page.locator("[data-field-key='specialties']");
    const licence = page.getByTestId("register-license-0");
    const hint = page.getByText("Use at least 3 characters, including a number.");

    await licence.fill("ab");
    await licence.blur();
    await expect(hint).toBeVisible();
    await expect(licence).toHaveAttribute("aria-invalid", "true");
    await expect(specialties).toHaveAttribute("data-complete", "0");

    await licence.fill("A12");
    await expect(hint).toHaveCount(0);
    await expect(specialties).toHaveAttribute("data-complete", "1");
  });

  test("\"Other\" reads as chosen and needs at least 3 letters", async ({ page }) => {
    await gotoRegisterPracticeStep(page);
    await page.getByTestId("register-specialty-trigger").click();
    await page.getByRole("button", { name: "Other (Specify)", exact: true }).click();
    await page.getByTestId("register-license-0").fill("1234");

    // The chosen "Other" reads like any chosen specialty, not like the placeholder.
    await expect(page.getByTestId("register-specialty-trigger")).toHaveAttribute(
      "data-has-value",
      "1",
    );

    const specialties = page.locator("[data-field-key='specialties']");
    const describe = page.getByLabel(/Describe your specialty/);
    const hint = page.getByText("Describe your specialty in at least 3 letters.");

    await describe.fill("ab");
    await describe.blur();
    await expect(hint).toBeVisible();
    await expect(specialties).toHaveAttribute("data-complete", "0");

    await describe.fill("Sports medicine");
    await expect(hint).toHaveCount(0);
    await expect(specialties).toHaveAttribute("data-complete", "1");
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
