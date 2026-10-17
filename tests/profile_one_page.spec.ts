import { expect, test } from "@playwright/test";
import { continueButton } from "./helpers/bookingCalendar";
import { fillBirthdate, fillPatientName, phoneBox } from "./helpers/bookingForm";
import { fillVisitReason } from "./helpers/fillVisitReason";

/**
 * Public profile redesign: one page with anchor tabs, light by default with a
 * Light/Dark switch anyone can use (remembered), motion that respects "reduce motion", and on
 * the right "Choose a clinic" (one row per clinic with its next free time) above that clinic's
 * calendar; the details form opens over the page (2026-10-14).
 */
const slug = (process.env.TEST_BOOKING_DOCTOR_SLUG ?? "andreas-nikos").trim();

type Page = import("@playwright/test").Page;

/** Picks the first time and opens the details form; retried until the page is hydrated. */
async function openDetailsForm(page: Page) {
  await expect(page.getByTestId("booking-selected-day")).toBeVisible({ timeout: 15000 });
  await expect(async () => {
    await page.locator("#book button[aria-pressed]").first().click();
    await continueButton(page).click({ timeout: 2_000 });
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/** Whether the profile shows a calendar with times (online booking open somewhere). */
async function hasOnlineTimes(page: Page): Promise<boolean> {
  return page
    .getByTestId("booking-selected-day")
    .waitFor({ timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
}

async function profileBackground(page: import("@playwright/test").Page): Promise<string> {
  return page.locator(".doccy-profile").first().evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.describe("Public profile one page", { tag: "@pr-e2e" }, () => {
  test("anchor tabs scroll within the page and mark the section", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "Profile sections" });
    await expect(nav).toBeVisible({ timeout: 15000 });

    // Server-rendered: a click before hydration jumps without the scroll spy; retry until wired.
    await expect(async () => {
      await nav.getByRole("link", { name: "About" }).click();
      await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "location", {
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    await expect(page).toHaveURL(/#about$/);
    await expect(page.locator("#about")).toBeInViewport();
    // The tabs travel with the page: a permanent index while reading any section.
    await expect(nav).toBeInViewport();

    // Booking is the column beside the sections, not a tab (2026-10-14). The other tabs
    // depend on what she filled in (services, qualifications, reviews): take the last one.
    await expect(nav.getByRole("link", { name: /^(Book|Clinics & contact)$/ })).toHaveCount(0);
    const last = nav.getByRole("link").last();
    const target = (await last.getAttribute("href"))!;
    expect(target).toMatch(/^#[a-z]+$/);
    await last.click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(nav).toBeInViewport();
  });

  test("opens in the site's default; anyone can switch and it is remembered", async ({ page }) => {
    // The founders' default (light or dark: Testing is set to dark), whatever the device says.
    const background = { light: "rgb(246, 250, 251)", dark: "rgb(8, 20, 42)" } as const;
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".doccy-profile")).toBeVisible({ timeout: 15000 });
    const initial = (await page.locator(".doccy-profile").first().getAttribute("data-scheme")) as "light" | "dark";
    expect(["light", "dark"]).toContain(initial);
    const other = initial === "light" ? "dark" : "light";
    expect(await profileBackground(page)).toBe(background[initial]);

    const modes = page.getByRole("group", { name: "Colour mode" });
    const button = (mode: "light" | "dark") => modes.getByRole("button", { name: mode === "light" ? "Light" : "Dark" });
    await expect(button(initial)).toHaveAttribute("aria-pressed", "true");

    // Server-rendered: retry the click until hydration has wired it.
    await expect(async () => {
      await button(other).click();
      await expect(button(other)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect.poll(() => profileBackground(page)).toBe(background[other]);

    // Remembered on reload (cookie read by the server: no flash of the default).
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await profileBackground(page)).toBe(background[other]);

    await expect(button(other)).toHaveAttribute("aria-pressed", "true");
    // Reloaded page: same hydration wait before the click counts.
    await expect(async () => {
      await button(initial).click();
      await expect(button(initial)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect.poll(() => profileBackground(page)).toBe(background[initial]);
  });

  test("stops animations when the patient reduces motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const animated = page.locator(".doccy-profile .profile-rise").first();
    test.skip((await animated.count()) === 0, "No animated element (doctor without availability).");
    expect(await animated.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("a clinic row shows that clinic's calendar on its next free day, and a time opens the details form", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    test.skip(!(await hasOnlineTimes(page)), "Doctor has no online availability right now.");

    // With several clinics, a row not chosen yet switches the calendar to that clinic.
    const other = page.locator("[data-testid='profile-clinic-option'][data-date]:not(:has([aria-current]))").first();
    if ((await other.count()) > 0) {
      const location = (await other.getAttribute("data-location"))!;
      const day = (await other.getAttribute("data-date"))!;
      await other.click();
      await expect(page).toHaveURL(new RegExp(`location=${location}`), { timeout: 20_000 });
      await expect(
        page.locator(`[data-testid='profile-clinic-option'][data-location='${location}'] [aria-current]`),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("booking-selected-day")).toHaveAttribute("data-date", day, { timeout: 20_000 });
    }
    const when = (await page.getByTestId("booking-selected-day").getAttribute("data-date"))!;
    expect(when).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // A time, then "Book this time": the details form opens over the page.
    await openDetailsForm(page);
    await expect(page.getByRole("heading", { name: "Your details" })).toBeInViewport();

    // "Change time" goes back to the calendar, on the same day with the same time picked.
    await page.getByRole("button", { name: "Change time" }).click();
    await expect(page.getByTestId("booking-selected-day")).toHaveAttribute("data-date", when);
    await expect(page.locator("#book button[aria-pressed='true']")).toHaveCount(1);
    await continueButton(page).click();
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

    // First and last name are two boxes, both required (2026-10-10).
    const send = page.getByRole("button", { name: /Send booking request/i });
    await page.locator("#firstName").fill("Alexander");
    await send.click();
    await expect(page.getByRole("alert").filter({ hasText: "Please enter your last name." })).toBeVisible();
    await page.locator("#lastName").fill("G");

    // The mobile keeps its +357 when emptied, shows an example, and must be a real Cyprus mobile.
    const phone = phoneBox(page);
    await expect(phone).toHaveAttribute("placeholder", /^9\d \d{6}$/);
    await expect(page.locator("#field-patientPhone .react-international-phone-dial-code-preview")).toHaveText("+357");
    await expect(page.getByText("Only if the clinic needs to reach you.")).toBeVisible();
    await phone.pressSequentially("9999999");
    await send.click();
    await expect(page.getByRole("alert").filter({ hasText: "Cyprus mobile numbers have 8 digits" })).toBeVisible();
    await phone.press("End");
    await phone.pressSequentially("9");

    // Gender and date of birth are asked too, and every field is required.
    await page.getByLabel("This is my first visit").check();
    await fillVisitReason(page, "Checking the form only.");
    await expect(page.getByRole("radio", { name: "Prefer not to say" })).toBeVisible();
    await send.click();
    await expect(page.getByRole("alert").filter({ hasText: "Please choose a gender option." })).toBeVisible();
    await page.getByRole("radio", { name: "Female" }).check();
    // Day / Month / Year: an impossible date is refused.
    await fillBirthdate(page, "1990-02-31");
    await send.click();
    await expect(page.getByRole("alert").filter({ hasText: "Please enter a valid date of birth." })).toBeVisible();
  });

  test("the patient picks one of her services (no prices) and may add their own words", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    test.skip(!(await hasOnlineTimes(page)), "Doctor has no online availability right now.");
    await openDetailsForm(page);

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
    await fillPatientName(page, "Service Picker Check");
    await page.getByLabel("Email", { exact: true }).fill("service.picker@example.test");
    await phoneBox(page).pressSequentially("99123456");
    await page.getByLabel("This is my first visit").check();
    await page.getByRole("radio", { name: "Prefer not to say" }).check();
    await fillBirthdate(page, "1990-01-01");
    await picker.selectOption({ label: firstService });
    await page.locator("#visitReason").fill("A spot on the side of my lip.");
    await page.getByRole("button", { name: /Send booking request/i }).click();
    await expect.poll(() => sent).not.toBeNull();
    expect(sent!.professionalServiceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent!.reason).toBe("A spot on the side of my lip.");
  });

  // UX pass (2026-10-11).
  test("the calendar opens on a day with times, and a picked day stays picked", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const selectedDay = page.getByTestId("booking-selected-day");
    test.skip(!(await hasOnlineTimes(page)), "No online availability.");
    await expect(page.locator("#book button[aria-pressed]").first()).toBeVisible();
    // Pressing the picked day again must not empty the times.
    const date = await selectedDay.getAttribute("data-date");
    await page.locator("#book .rdp-day_selected").first().click();
    await expect(selectedDay).toHaveAttribute("data-date", date!);
    await expect(page.locator("#book button[aria-pressed]").first()).toBeVisible();
  });

  test("Send marks every missing field at once and takes the patient to the first", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    test.skip(!(await hasOnlineTimes(page)), "No online availability.");
    await openDetailsForm(page);
    await page.getByRole("button", { name: /Send booking request/i }).click();
    // First and last name, email, mobile, first visit, gender, birth date, service or reason.
    await expect.poll(() => page.getByRole("alert").count()).toBeGreaterThanOrEqual(7);
    await expect(page.locator("#firstName")).toBeFocused();
    // Fixing one field clears only its own message.
    const before = await page.getByRole("alert").count();
    await page.locator("#firstName").fill("Alexander");
    await expect.poll(() => page.getByRole("alert").count()).toBe(before - 1);
  });

  test("a service's own Book button picks that service in the form", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const button = page.getByTestId("profile-service-book").first();
    test.skip((await button.count()) === 0, "This professional lists no services.");
    test.skip(!(await hasOnlineTimes(page)), "No online availability.");
    const name = (await button.getAttribute("data-service-name"))!;
    // Server-rendered: before hydration the button is a plain #book link; retry until wired.
    await expect(async () => {
      await button.click();
      await expect(page.getByTestId("booking-for-service")).toContainText(name, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    // The booking column is beside the sections on a wide page: the calendar is on screen.
    await expect(page.locator("#book")).toBeInViewport();
    await openDetailsForm(page);
    await expect(page.locator("#professionalService option:checked")).toHaveText(name);
  });

  test("the details form has a bar: Change time goes back to the times, the cross closes it", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    test.skip(!(await hasOnlineTimes(page)), "No online availability.");
    await openDetailsForm(page);
    const bar = page.getByTestId("booking-form-bar");
    await expect(bar.getByRole("button", { name: "Change time" })).toBeVisible();
    await bar.getByTestId("booking-form-close").click();
    await expect(page.getByRole("heading", { name: "Your details" })).toHaveCount(0);
    await expect(page.getByTestId("booking-selected-day")).toBeVisible();
  });

  test("tells about the email step, and keeps the install banner off the page", async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-doccy-hide-install-banner", "", { timeout: 15000 });
    test.skip(!(await hasOnlineTimes(page)), "No online availability.");
    // Beside the details form (2026-10-14).
    await openDetailsForm(page);
    const steps = page.getByRole("list", { name: "What to expect" }).getByRole("listitem");
    await expect(steps).toHaveCount(4, { timeout: 15000 });
    await expect(steps.nth(1)).toContainText("Confirm by email");
    await expect(steps.nth(1)).toContainText("30 minutes");
  });

  test("a soft fade marks that the page continues below, and goes away at the end", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const fade = page.getByTestId("profile-scroll-fade");
    await expect(fade).toHaveAttribute("data-visible", "true", { timeout: 15000 });
    // On a short profile the first jump stops short: the pinned hero shrinks as the page
    // scrolls and the end moves, so keep scrolling to the real bottom (as a reader would).
    await expect(async () => {
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
      await expect(fade).toHaveAttribute("data-visible", "false", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
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

  test("on phones a Book bar appears once the hero scrolls away", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
    const bar = page.getByTestId("profile-mobile-book-bar");
    await expect(bar).toHaveAttribute("data-visible", "false", { timeout: 15000 });
    await page.evaluate(() => document.getElementById("about")?.scrollIntoView({ behavior: "instant" }));
    // On a short profile the calendar (below the sections on a phone) stays on screen: no bar.
    // The bar's own rule: the calendar counts as on screen inside 80px top and bottom margins.
    const bookStillOnScreen = await page.evaluate(() => {
      const rect = document.getElementById("book")?.getBoundingClientRect();
      return Boolean(rect && rect.top < window.innerHeight - 80 && rect.bottom > 80);
    });
    test.skip(bookStillOnScreen, "This profile is too short to scroll the calendar away.");
    await expect(bar).toHaveAttribute("data-visible", "true");
    await expect(bar.getByRole("link", { name: /^Book$/ })).toHaveAttribute("href", "#book");
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
