import { test, expect, type Page } from "@playwright/test";
import {
  DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE,
  DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST,
} from "@/lib/doccy-feedback";

/** Stands in for our own copy of the message (user_events); returns what the form sent it. */
async function captureSupportCopies(page: Page): Promise<Record<string, unknown>[]> {
  const copies: Record<string, unknown>[] = [];
  await page.route("**/api/support-message", async (route) => {
    copies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  return copies;
}

test.describe("Support feedback modal (Formspree)", { tag: "@pr-e2e" }, () => {
  test("submitting the form shows success when Formspree accepts the POST", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Stabilized for desktop Chromium.",
    );
    test.setTimeout(60_000);

    const copies = await captureSupportCopies(page);
    await page.route("https://formspree.io/f/**", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/for-professionals");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Run a Smarter Practice/i,
      }),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("marketing-footer").getByRole("button", { name: /^Support$/i }).click();
    await expect(
      page.getByRole("dialog", { name: /How can we help you/i }),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("textbox", { name: /message/i }).fill("E2E support modal smoke message.");
    await page.getByRole("textbox", { name: /email/i }).fill("visitor@example.com");
    await page.getByRole("button", { name: /^Send message$/i }).click();

    await expect(page.getByText(/Thanks — we received your message\./i)).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText(/follow up/i)).toBeVisible();
  });

  test("a visitor must leave an email, and it reaches Formspree as `email`", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Stabilized for desktop Chromium.",
    );
    test.setTimeout(60_000);

    const posted: string[] = [];
    const copies = await captureSupportCopies(page);
    await page.route("https://formspree.io/f/**", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      posted.push(route.request().postData() ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/for-professionals");
    await page.getByTestId("marketing-footer").getByRole("button", { name: /^Support$/i }).click();
    const dialog = page.getByRole("dialog", { name: /How can we help you/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByRole("textbox", { name: /message/i }).fill("No email yet.");
    await dialog.getByRole("button", { name: /^Send message$/i }).click();
    await expect(dialog.getByText(/email/i).filter({ hasText: /enter|valid|required/i })).toBeVisible();
    expect(posted).toHaveLength(0);

    await dialog.getByRole("textbox", { name: /email/i }).fill("visitor@example.com");
    await dialog.getByRole("button", { name: /^Send message$/i }).click();
    await expect(dialog.getByText(/Thanks — we received your message\./i)).toBeVisible({
      timeout: 8000,
    });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain("visitor@example.com");
    expect(posted[0]).toMatch(/name="email"/);
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ email: "visitor@example.com", message: "No email yet." });
  });

  test("Report incorrect info refuses the untouched template, then sends once details are added", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Stabilized for desktop Chromium.",
    );
    test.setTimeout(60_000);

    const posted: string[] = [];
    const copies = await captureSupportCopies(page);
    await page.route("https://formspree.io/f/**", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      posted.push(route.request().postData() ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/all/dentist");
    await page.getByRole("button", { name: /^Report incorrect info$/i }).first().click();
    const dialog = page.getByRole("dialog", { name: /How can we help you/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.getByRole("textbox", { name: /email/i }).fill("visitor@example.com");
    await dialog.getByRole("button", { name: /^Send message$/i }).click();
    await expect(dialog.getByText(/what seems incorrect/i).last()).toBeVisible();
    expect(posted).toHaveLength(0);

    const message = dialog.getByRole("textbox", { name: /message/i });
    await message.press("Control+End");
    await message.pressSequentially("The phone number is wrong.");
    await dialog.getByRole("button", { name: /^Send message$/i }).click();
    await expect(dialog.getByText(/Thanks — we received your message\./i)).toBeVisible({
      timeout: 8000,
    });
    expect(posted).toHaveLength(1);
    expect(copies).toHaveLength(1);
    expect(copies[0].context).toMatchObject({
      kind: "incorrect_listing_info",
      professional: expect.any(String),
      specialty: expect.any(String),
      district: expect.any(String),
    });
  });

  test("register onboarding CTA opens feedback with locked Onboarding Request topic and prefill", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Stabilized for desktop Chromium.",
    );

    await page.goto("/register", { waitUntil: "load" });

    const demoButton = page.getByTestId("register-demo-booking");
    await expect(demoButton).toBeVisible({ timeout: 15_000 });
    await demoButton.click();

    const dialog = page.getByRole("dialog", { name: /How can we help you/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST)).toBeVisible();
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await expect(dialog.getByRole("textbox", { name: /message/i })).toHaveValue(
      DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE,
    );
  });
});
