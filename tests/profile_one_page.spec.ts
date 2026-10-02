import { expect, test } from "@playwright/test";

/**
 * Public profile redesign: one page with anchor tabs, light by default with a
 * Light/Dark switch anyone can use (remembered), motion that respects "reduce motion", and
 * next-availability day cards that open that day in the booking calendar.
 */
const slug = (process.env.TEST_BOOKING_DOCTOR_SLUG ?? "andreas-nikos").trim();

async function profileBackground(page: import("@playwright/test").Page): Promise<string> {
  return page.locator(".doccy-profile").first().evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.describe("Public profile one page", { tag: "@pr-e2e" }, () => {
  test("anchor tabs scroll within the page and mark the section", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "Profile sections" });
    await expect(nav).toBeVisible({ timeout: 15000 });

    await nav.getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/#about$/);
    await expect(page.locator("#about")).toBeInViewport();
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "location");
    // The tabs travel with the page: a permanent index while reading any section.
    await expect(nav).toBeInViewport();

    await nav.getByRole("link", { name: "Clinics & contact" }).click();
    await expect(page).toHaveURL(/#clinics$/);
    await expect(nav).toBeInViewport();

    await nav.getByRole("link", { name: "Book" }).click();
    await expect(page).toHaveURL(/#book$/);
    await expect(page.locator("#book")).toBeInViewport();
  });

  test("opens in light; anyone can switch to dark and it is remembered", async ({ page }) => {
    // Light by default, even on a device set to dark.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".doccy-profile")).toBeVisible({ timeout: 15000 });
    expect(await profileBackground(page)).toBe("rgb(246, 250, 251)");

    const modes = page.getByRole("group", { name: "Colour mode" });
    const dark = modes.getByRole("button", { name: "Dark" });
    const light = modes.getByRole("button", { name: "Light" });
    await expect(light).toHaveAttribute("aria-pressed", "true");

    // Server-rendered: retry the click until hydration has wired it.
    await expect(async () => {
      await dark.click();
      await expect(dark).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect.poll(() => profileBackground(page)).toBe("rgb(11, 20, 24)");

    // Remembered on reload (cookie read by the server: no flash of light).
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await profileBackground(page)).toBe("rgb(11, 20, 24)");

    await expect(dark).toHaveAttribute("aria-pressed", "true");
    // Reloaded page: same hydration wait before the click counts.
    await expect(async () => {
      await light.click();
      await expect(light).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect.poll(() => profileBackground(page)).toBe("rgb(246, 250, 251)");
  });

  test("stops animations when the patient reduces motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const animated = page.locator(".doccy-profile .profile-rise").first();
    test.skip((await animated.count()) === 0, "No animated element (doctor without availability).");
    expect(await animated.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("a next-availability day opens that day in the calendar", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const dayCards = page.getByTestId("profile-next-availability-day");
    await expect(page.getByTestId("profile-next-availability")).toBeVisible({ timeout: 15000 });
    test.skip((await dayCards.count()) === 0, "Doctor has no online availability right now.");

    const second = dayCards.nth(Math.min(1, (await dayCards.count()) - 1));
    const dateKey = await second.getAttribute("data-date");
    expect(dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await second.click();

    await expect(page).toHaveURL(/#book$/);
    await expect(page.getByTestId("booking-selected-day")).toHaveAttribute("data-date", dateKey!);

    // Picking a time brings the Confirm button into view, on any screen size.
    await page.locator("#book button[aria-pressed]").first().click();
    await expect(page.getByRole("button", { name: "Confirm" })).toBeInViewport();

    // Confirm opens the details form at its top.
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("heading", { name: "Your details" })).toBeInViewport();

    // A typo in a common email domain gets a "Did you mean …?" fix, as on /register.
    const email = page.getByLabel("Email", { exact: true });
    await email.fill("sdf@gmai.com");
    await email.blur();
    const suggestion = page.getByTestId("booking-email-suggestion");
    await expect(suggestion).toContainText("sdf@gmail.com");
    await suggestion.getByRole("button", { name: "sdf@gmail.com" }).click();
    await expect(email).toHaveValue("sdf@gmail.com");
    await expect(suggestion).toHaveCount(0);
  });

  test("a soft fade marks that the page continues below, and goes away at the end", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const fade = page.getByTestId("profile-scroll-fade");
    await expect(fade).toHaveAttribute("data-visible", "true", { timeout: 15000 });
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect(fade).toHaveAttribute("data-visible", "false");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(fade).toHaveAttribute("data-visible", "true");
  });

  test("ends with an About DocCy link to the professionals page", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const about = page.getByRole("link", { name: "About DocCy" });
    await expect(about).toHaveAttribute("href", "/for-professionals");
  });
});
