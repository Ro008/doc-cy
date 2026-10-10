import { expect, test } from "@playwright/test";
import { fillVisitReason } from "./helpers/fillVisitReason";

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
    // Before hydration the card is a plain #book link (it still scrolls); retry the click.
    await expect(async () => {
      await second.click();
      await expect(page.getByTestId("booking-selected-day")).toHaveAttribute("data-date", dateKey!, {
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    await expect(page).toHaveURL(/#book$/);

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

    // Gender and date of birth are asked too, and every field is required.
    await page.getByLabel("Full name", { exact: true }).fill("Profile Form Check");
    await page.getByRole("textbox", { name: /Phone/i }).pressSequentially("99123456");
    await page.getByLabel("This is my first visit").check();
    await fillVisitReason(page, "Checking the form only.");
    await expect(page.getByRole("radio", { name: "Prefer not to say" })).toBeVisible();
    await page.getByRole("button", { name: /Send booking request/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Please choose a gender option." })).toBeVisible();
    await page.getByRole("radio", { name: "Female" }).check();
    await page.getByRole("button", { name: /Send booking request/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Please enter a valid date of birth." })).toBeVisible();
  });

  test("the patient picks one of her services (no prices) and may add their own words", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const dayCards = page.getByTestId("profile-next-availability-day");
    await expect(page.getByTestId("profile-next-availability")).toBeVisible({ timeout: 15000 });
    test.skip((await dayCards.count()) === 0, "Doctor has no online availability right now.");
    await expect(async () => {
      await dayCards.first().click();
      await expect(page.getByTestId("booking-selected-day")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await page.locator("#book button[aria-pressed]").first().click();
    await page.getByRole("button", { name: "Confirm" }).click();

    const picker = page.locator("#professionalService");
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
    test.skip((await picker.count()) === 0, "This professional lists no services.");

    const labels = await picker.locator("option").allTextContents();
    expect(labels[0]).toBe("Choose a service");
    expect(labels.at(-1)).toBe("Other");
    expect(labels.join(" ")).not.toMatch(/€|EUR/);

    // The text box is always there: optional with a service, required with Other.
    const firstService = labels[1];
    await picker.selectOption({ label: firstService });
    await expect(page.locator("#visitReason")).toBeVisible();
    await expect(page.getByText(/should know\? \(optional\)/)).toBeVisible();
    await picker.selectOption({ label: "Other" });
    await expect(page.getByText("Tell us briefly what you need")).toBeVisible();

    // The request carries the chosen service's id (answered here, nothing is booked).
    let sent: Record<string, unknown> | null = null;
    await page.route("**/api/appointments", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ status: 400, json: { message: "Stopped by the test." } });
    });
    await page.getByLabel("Full name", { exact: true }).fill("Service Picker Check");
    await page.getByLabel("Email", { exact: true }).fill("service.picker@example.test");
    await page.getByRole("textbox", { name: /Phone/i }).pressSequentially("99123456");
    await page.getByLabel("This is my first visit").check();
    await page.getByRole("radio", { name: "Prefer not to say" }).check();
    await page.locator("#patientBirthdate").fill("1990-01-01");
    await picker.selectOption({ label: firstService });
    await page.locator("#visitReason").fill("A spot on the side of my lip.");
    await page.getByRole("button", { name: /Send booking request/i }).click();
    await expect.poll(() => sent).not.toBeNull();
    expect(sent!.professionalServiceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent!.reason).toBe("A spot on the side of my lip.");
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

  test("search engines see the profile's own canonical URL and breadcrumbs", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/en/${slug}$`));
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs).toBeVisible({ timeout: 15000 });
    await expect(crumbs.getByRole("link").first()).toHaveAttribute("href", /^\//);
    const types = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap((s) => {
        const parsed = JSON.parse(s.textContent || "null");
        return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => item?.["@type"]);
      }),
    );
    expect(types).toEqual(expect.arrayContaining(["Physician", "BreadcrumbList"]));
  });

  test("each clinic shows its opening hours", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const hours = page.getByTestId("profile-clinic-hours");
    test.skip((await hours.count()) === 0, "No clinic with a published schedule.");
    await expect(hours.first()).toContainText(/\d{2}:\d{2}–\d{2}:\d{2}/);
  });

  test("on phones a Request appointment bar appears once the hero scrolls away", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const bar = page.getByTestId("profile-mobile-book-bar");
    await expect(bar).toHaveAttribute("data-visible", "false", { timeout: 15000 });
    await page.evaluate(() => document.getElementById("about")?.scrollIntoView({ behavior: "instant" }));
    await expect(bar).toHaveAttribute("data-visible", "true");
    await expect(bar.getByRole("link", { name: /Request appointment/ })).toHaveAttribute("href", "#book");
    // Hidden again while the booking calendar itself is on screen.
    await page.evaluate(() => document.getElementById("book")?.scrollIntoView({ behavior: "instant" }));
    await expect(bar).toHaveAttribute("data-visible", "false");
  });

  test("Share copies the profile link where the system share sheet is missing", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Playwright can grant clipboard access only in Chromium.");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const share = page.getByRole("button", { name: "Share" });
    await expect(async () => {
      await share.click();
      await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toHaveCount(1, { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(new RegExp(`/en/${slug}$`));
  });

  test("Report incorrect information opens the feedback form about this profile", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const report = page.getByRole("button", { name: "Report incorrect information" });
    // The feedback form's message box, prefilled with which profile it is about.
    const prefilled = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll("textarea"))
          .map((t) => t.value)
          .find((v) => v.startsWith("Incorrect information")) ?? null,
      );
    await expect(async () => {
      await report.click();
      expect(await prefilled()).not.toBeNull();
    }).toPass({ timeout: 20_000 });
    expect(await prefilled()).toMatch(new RegExp(`/en/${slug}`));
  });

  test("ends with an About DocCy link to the professionals page", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const about = page.getByRole("link", { name: "About DocCy" });
    await expect(about).toHaveAttribute("href", "/for-professionals");
  });
});
