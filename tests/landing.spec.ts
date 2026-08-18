// tests/landing.spec.ts
import { test, expect } from "@playwright/test";

const HERO_TITLE = /Run a Smarter Practice/i;
const PRIMARY_CTA = /List my practice/i;

test.describe("Landing page", () => {
  test("displays main headline and primary CTA", async ({ page }) => {
    await page.goto("/for-professionals");

    await expect(
      page.getByRole("heading", { level: 1, name: HERO_TITLE }),
    ).toBeVisible();

    const primaryCta = page.locator('a[href="#founders-pricing-card"]').first();
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
    await page.goto("/for-professionals");

    const footer = page.getByTestId("marketing-footer");
    await expect(footer).toBeVisible();

    await expect(footer.getByRole("link", { name: /^Find a Professional$/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /^Find a Clinic$/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /^About DocCy$/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /^Blog$/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /^Terms$/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /^Privacy$/i })).toBeVisible();
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
    expect(navLabels).toContain("Find a Clinic");
    expect(navLabels).toContain("About DocCy");
    expect(navLabels).toContain("Blog");
    expect(navLabels).toContain("Terms");
    expect(navLabels).toContain("Privacy");
    expect(navLabels).toContain("Support");
    expect(navLabels).toContain("Instagram");
    expect(navLabels.indexOf("Terms")).toBeLessThan(navLabels.indexOf("Privacy"));
    expect(navLabels.indexOf("Privacy")).toBeLessThan(navLabels.indexOf("Support"));
    expect(navLabels.indexOf("Support")).toBeLessThan(navLabels.indexOf("Instagram"));

    await footer.getByRole("button", { name: /^Support$/i }).click();
    await expect(
      page.getByRole("dialog", { name: /How can we help you/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("primary CTA navigates to founders pricing section", async ({ page }) => {
    await page.goto("/for-professionals");
    const cta = page.locator('a[href="#founders-pricing-card"]').first();
    await expect(cta).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/for-professionals#founders-pricing-card$/, { timeout: 10000 }),
      cta.click(),
    ]);

    await expect(page).toHaveURL(/\/for-professionals#founders-pricing-card$/);
    await expect(
      page.getByRole("heading", {
        name: /€19\/month\. Locked for life\./i,
      }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("priority ranking tooltip stays within viewport on mobile", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("Mobile"), "Mobile-only coverage.");

    await page.goto("/for-professionals#founders-pricing");

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

  test("how it works section is present", async ({ page }) => {
    await page.goto("/for-professionals");

    const section = page.locator("#how-it-works");
    await expect(
      section.getByRole("heading", { name: /Getting started is this simple/i }),
    ).toBeVisible();
    await expect(section.getByText(/Create your profile/i)).toBeVisible();
    await expect(section.getByText(/Total synchronization/i)).toBeVisible();
  });

  test("pricing section shows risk-free intro before founders card", async ({ page }) => {
    await page.goto("/for-professionals#founders-pricing");

    await expect(
      page.getByRole("heading", {
        name: /Your practice, upgraded\. 100% risk-free\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/Building a private website in Cyprus can cost you over/i),
    ).toBeVisible();

    const pricingCard = page.locator("#founders-pricing-card");
    await expect(pricingCard).toBeVisible();
  });

  test("FAQ section shows key objections below pricing", async ({ page }) => {
    await page.goto("/for-professionals#founders-pricing");

    await expect(
      page.getByRole("heading", {
        name: /Frequently asked questions/i,
      }),
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText(/Will using DocCy create double bookings or extra work\?/i),
    ).toBeVisible();
    await expect(
      page.getByText(
        /How do I get my current patients to start using this online system\?/i,
      ),
    ).toBeVisible();
    await expect(page.getByText(/How long does it take to set up\? I am very busy\./i)).toBeVisible();
  });

  test("FAQ accordion reveals answer for double bookings objection", async ({ page }) => {
    await page.goto("/for-professionals#founders-pricing");

    const faqToggle = page
      .locator("summary")
      .filter({
        hasText: /Will using DocCy create double bookings or extra work\?/i,
      })
      .first();
    await expect(faqToggle).toBeVisible({ timeout: 10000 });
    await faqToggle.click();

    await expect(page.getByText(/single source of truth/i)).toBeVisible();
    await expect(page.getByText(/instantly blocked on your public profile/i)).toBeVisible();
  });

  test("FAQ accordion reveals patient adoption answer", async ({ page }) => {
    await page.goto("/for-professionals#founders-pricing");

    const faqToggle = page
      .locator("summary")
      .filter({
        hasText:
          /How do I get my current patients to start using this online system\?/i,
      })
      .first();
    await expect(faqToggle).toBeVisible({ timeout: 10000 });
    await faqToggle.click();

    await expect(page.getByText(/Practice Promotion tools/i)).toBeVisible();
    await expect(page.getByText(/QR code for your reception desk/i)).toBeVisible();
  });
});
