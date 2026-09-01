import { test, expect } from "@playwright/test";
import { createTestDataClient } from "./helpers/testDataClient";

test.describe("Public profile states", () => {
  test.beforeAll(() => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").not.toBe("");
    expect(
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim() ||
        (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
    ).not.toBe("");
  });

  async function getFirstSlugByStatus(status: string): Promise<string | null> {
    const supabase = createTestDataClient();
    const { data } = await supabase
      .from("professionals")
      .select("slug")
      .eq("status", status)
      .not("slug", "is", null)
      .limit(10);

    const slug = data?.[0]?.slug;
    return typeof slug === "string" && slug.length > 0 ? slug : null;
  }

  test("pending: shows profile under review + no booking calendar", async ({
    page,
  }) => {
    const slug = await getFirstSlugByStatus("pending");
    test.skip(!slug, "No pending doctors found in Supabase seed.");

    await page.goto(`/${slug}`);

    await expect(
      page.getByRole("heading", { name: /Profile under review/i })
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText(/This professional has applied to join DocCy/i)
    ).toBeVisible({ timeout: 10000 });

    await expect(page.locator("text=Select a date on the calendar")).toHaveCount(0);
    await expect(page.locator("text=Book an appointment")).toHaveCount(0);

    // CTAs
    await expect(
      page.getByRole("heading", { name: /I'm the professional/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /Log in/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: /I want to book/i })
    ).toBeVisible({ timeout: 10000 });
    const findProfessionalPending = page
      .getByRole("link", { name: /Find a professional/i })
      .first();
    await expect(findProfessionalPending).toBeVisible({ timeout: 10000 });
    await expect(findProfessionalPending).toHaveAttribute("href", "/");
  });

  test("rejected: shows profile unavailable + no booking calendar", async ({
    page,
  }) => {
    const slug = await getFirstSlugByStatus("rejected");
    test.skip(!slug, "No rejected doctors found in Supabase seed.");

    await page.goto(`/${slug}`);

    await expect(
      page.getByRole("heading", { name: /Profile unavailable/i })
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText(/This profile cannot be shown for public booking on DocCy/i)
    ).toBeVisible({ timeout: 10000 });

    await expect(page.locator("text=Select a date on the calendar")).toHaveCount(0);
    await expect(page.locator("text=Book an appointment")).toHaveCount(0);

    // CTAs
    await expect(
      page.getByRole("heading", { name: /I'm the professional/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /Log in/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: /I want to book/i })
    ).toBeVisible({ timeout: 10000 });
    const findProfessionalRejected = page
      .getByRole("link", { name: /Find a professional/i })
      .first();
    await expect(findProfessionalRejected).toBeVisible({ timeout: 10000 });
    await expect(findProfessionalRejected).toHaveAttribute("href", "/");
  });

  test("activated/verified: shows live profile + booking calendar", async ({
    page,
  }) => {
    const supabase = createTestDataClient();
    const { data } = await supabase
      .from("professionals")
      .select("slug")
      .eq("status", "verified")
      .not("slug", "is", null)
      .limit(12);

    const candidates = data ?? [];
    let chosenSlug: string | null = null;

    for (const d of candidates) {
      const slug = d?.slug;
      if (!slug) continue;

      await page.goto(`/${slug}`);

      // If the doctor has no published availability, BookingSection hides the calendar.
      if (await page.getByText("Select a date on the calendar").isVisible()) {
        chosenSlug = slug;
        break;
      }
    }

    test.skip(!chosenSlug, "No verified doctor with published availability found for E2E.");

    await expect(page.getByRole("heading", { name: /Book an appointment/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Profile under review")).toHaveCount(0);
    await expect(page.locator("text=Profile unavailable")).toHaveCount(0);
  });
});

