// tests/landing.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("displays main headline and primary CTA", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /your professional website\s*&\s*online agenda/i,
      }),
    ).toBeVisible();

    const primaryCta = page.getByRole("link", {
      name: /Claim your professional profile/i,
    });
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "#founders-pricing-card");

    const professionalLogin = page.getByRole("link", {
      name: /Professional Login/i,
    });
    await expect(professionalLogin).toBeVisible();
    await expect(professionalLogin).toHaveAttribute("href", "/login");
  });

  test("marketing footer shows core links, Support before Instagram, and Support opens feedback", async ({
    page,
  }) => {
    await page.goto("/");

    const footer = page.getByTestId("marketing-footer");
    await expect(footer).toBeVisible();

    await expect(footer.getByRole("link", { name: /^Find a Professional$/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /^About DocCy$/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /^Blog$/i })).toBeVisible();
    await expect(footer.getByRole("button", { name: /^Support$/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /^Instagram$/i })).toBeVisible();

    const navLabels = await footer.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          '[data-testid="marketing-footer"] a[href], [data-testid="marketing-footer"] button[type="button"]'
        )
      )
        .map((el) => el.textContent?.trim() ?? "")
        .filter(Boolean)
    );

    expect(navLabels).toContain("Find a Professional");
    expect(navLabels).toContain("About DocCy");
    expect(navLabels).toContain("Blog");
    expect(navLabels).toContain("Support");
    expect(navLabels).toContain("Instagram");
    expect(navLabels.indexOf("Support")).toBeLessThan(navLabels.indexOf("Instagram"));

    await footer.getByRole("button", { name: /^Support$/i }).click();
    await expect(
      page.getByRole("dialog", { name: /How can we help you/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("primary CTA navigates to founders pricing section", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", {
      name: /Claim your professional profile/i,
    });
    await expect(cta).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/#founders-pricing-card$/, { timeout: 10000 }),
      cta.click(),
    ]);

    await expect(page).toHaveURL(/\/#founders-pricing-card$/);
    await expect(
      page.getByRole("heading", {
        name: /Special launch pricing for the first 100 practitioners across Cyprus/i,
      }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("priority ranking tooltip stays within viewport on mobile", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("Mobile"), "Mobile-only coverage.");

    await page.goto("/#founders-pricing");

    const infoButton = page.getByRole("button", { name: /priority placement/i }).first();
    await expect(infoButton).toBeVisible({ timeout: 10000 });
    await infoButton.click();

    const tooltip = page.getByRole("tooltip").first();
    await expect(tooltip).toBeVisible();

    const bounds = await tooltip.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, viewportWidth: window.innerWidth };
    });

    expect(bounds.left).toBeGreaterThanOrEqual(4);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth - 4);
  });

  test("adoption playbook section links to founders pricing", async ({ page }) => {
    await page.goto("/");

    const playbook = page.locator("#adoption-playbook");
    await expect(
      playbook.getByRole("heading", { name: /Shift phone traffic to the screen/i }),
    ).toBeVisible();
    await expect(
      playbook.getByText(/Once you're verified, open Promote your practice in Settings/i),
    ).toBeVisible();

    const playbookCta = playbook.getByRole("link", { name: "See launch pricing", exact: true });
    await expect(playbookCta).toBeVisible();
    await expect(playbookCta).toHaveAttribute("href", "#founders-pricing-card");
  });

  test("FAQ section shows key objections below pricing", async ({ page }) => {
    await page.goto("/#founders-pricing");

    await expect(
      page.getByRole("heading", {
        name: /Common questions/i,
      }),
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText(/What if a patient calls me by phone\? Will I have double bookings\?/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Will using DocCy create extra work for my front desk staff\?/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Won't a private website give me more visibility than a profile\?/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Can my secretary or team manage the agenda for me\?/i),
    ).toBeVisible();
    await expect(page.getByText(/How long does it take to set up\? I am busy\./i)).toBeVisible();
  });

  test("FAQ accordion reveals answer for double bookings objection", async ({ page }) => {
    await page.goto("/#founders-pricing");

    const faqToggle = page
      .locator("summary")
      .filter({ hasText: /What if a patient calls me by phone\? Will I have double bookings\?/i })
      .first();
    await expect(faqToggle).toBeVisible({ timeout: 10000 });
    await faqToggle.click();

    await expect(page.getByText(/single source of truth/i)).toBeVisible();
    await expect(page.getByText(/slot is instantly blocked on your public profile/i)).toBeVisible();
  });
});
