import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { FINDER_RESULTS_PAGE_SIZE } from "@/lib/finder-results-paging";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";

type CreatedDoctor = {
  doctorId: string;
  authUserId: string;
  slug: string;
  name: string;
};

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

function assertSafeIntegrationTarget(baseUrl: string, supabaseUrl: string): string | null {
  const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";
  const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
  const integrationSupabase = normalizeUrl(supabaseUrl);
  const usingProductionSupabase = prodSupabase.length > 0 && integrationSupabase === prodSupabase;
  const unsafeBase = /mydoccy\.com/i.test(baseUrl);
  if (!safeEnv || unsafeBase || usingProductionSupabase) {
    return "Unsafe target or missing INTEGRATION_SAFE_ENV.";
  }
  return null;
}

const TEST_NAME_MARKER = /\btest\b/i;
const TEST_EMAIL_MARKER = /@(integration\.test|.*\.testing)$/i;
const TEST_SLUG_MARKER = /^(booking-flow-|finder-card-|finder-ux-|finder-filter-)/i;

function finderIncludesRegisteredTestProfiles(): boolean {
  return String(process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES ?? "").trim() === "1";
}

function isTestProfileLike(row: {
  name: string;
  slug?: string | null;
  email?: string | null;
  isTestProfile?: boolean | null;
}): boolean {
  if (row.isTestProfile === true) return true;
  if (TEST_NAME_MARKER.test(row.name)) return true;
  if (TEST_SLUG_MARKER.test(String(row.slug ?? ""))) return true;
  if (TEST_EMAIL_MARKER.test(String(row.email ?? ""))) return true;
  return false;
}

async function createVerifiedDoctor(
  admin: ReturnType<typeof createClient>,
  nonce: string,
  input: {
    slugPrefix: string;
    name: string;
    specialty: string;
    district: "Nicosia" | "Limassol" | "Paphos" | "Larnaca" | "Famagusta";
    languages: string[];
    avatarPath?: string;
  }
): Promise<CreatedDoctor> {
  // Use a cleanup-recognized suffix. Visibility in finder requires
  // NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1 (set in CI / .env.testing.local).
  const email = `${input.slugPrefix}-${nonce}@test-doccy.com.cy`;
  const slug = `${input.slugPrefix}-${nonce}`;
  const userRes = await admin.auth.admin.createUser({
    email,
    password: "StrongPass123!",
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (userRes.error || !userRes.data.user?.id) {
    throw new Error(`Failed creating auth user: ${userRes.error?.message}`);
  }
  const authUserId = userRes.data.user.id;

  const doctorInsert = await admin
    .from("doctors")
    .insert({
      auth_user_id: authUserId,
      name: input.name,
      specialty: input.specialty,
      district: input.district,
      email,
      phone: "+35799123456",
      languages: input.languages,
      avatar_url: input.avatarPath ?? null,
      license_number: `LIC-FINDER-${nonce}-${input.slugPrefix}`,
      license_file_url: `licenses/integration/${nonce}-${input.slugPrefix}.pdf`,
      status: "verified",
      slug,
      is_specialty_approved: true,
      // Mark as test so cleanup + prod finder hide are reliable; still visible when
      // NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1 (integration).
      is_test_profile: true,
      subscription_tier: "standard",
    })
    .select("id")
    .single();

  if (doctorInsert.error || !doctorInsert.data?.id) {
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed creating doctor row: ${doctorInsert.error?.message}`);
  }

  return {
    doctorId: String(doctorInsert.data.id),
    authUserId,
    slug,
    name: input.name,
  };
}

async function seedWeekdayAvailabilitySettings(
  admin: ReturnType<typeof createClient>,
  doctorId: string,
): Promise<void> {
  const day = {
    enabled: true,
    start_time: "09:00:00",
    end_time: "17:00:00",
  };
  const disabledDay = {
    enabled: false,
    start_time: "09:00:00",
    end_time: "17:00:00",
  };
  const settingsUpsert = await admin.from("doctor_settings").upsert(
    {
      doctor_id: doctorId,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      start_time: "09:00:00",
      end_time: "17:00:00",
      weekly_schedule: {
        monday: day,
        tuesday: day,
        wednesday: day,
        thursday: day,
        friday: day,
        saturday: disabledDay,
        sunday: disabledDay,
      },
      break_start: null,
      break_end: null,
      holiday_mode_enabled: false,
      holiday_start_date: null,
      holiday_end_date: null,
      pause_online_bookings: false,
      slot_duration_minutes: 30,
      booking_horizon_days: 90,
      minimum_notice_hours: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "doctor_id" },
  );
  if (settingsUpsert.error) {
    throw new Error(`Failed preparing doctor settings: ${settingsUpsert.error.message}`);
  }
}

test.describe("Integration: finder business-critical UX", { tag: ["@pr-e2e", "@pr-e2e-finder"] }, () => {
  test("footer popular quick links should lead to non-empty finder results", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Run this matrix only once on desktop to avoid mobile timeout noise."
    );
    test.setTimeout(180000);

    const footerSearches = [
      { city: "Nicosia", specialty: "Dentists", path: "/nicosia/dentist" },
      { city: "Nicosia", specialty: "Dermatologists", path: "/nicosia/dermato-venereology" },
      { city: "Nicosia", specialty: "Physiotherapists", path: "/nicosia/physiotherapist" },
      { city: "Limassol", specialty: "Dentists", path: "/limassol/dentist" },
      { city: "Limassol", specialty: "Dermatologists", path: "/limassol/dermato-venereology" },
      { city: "Limassol", specialty: "Physiotherapists", path: "/limassol/physiotherapist" },
      { city: "Paphos", specialty: "Dentists", path: "/paphos/dentist" },
      { city: "Paphos", specialty: "Dermatologists", path: "/paphos/dermato-venereology" },
      { city: "Paphos", specialty: "Physiotherapists", path: "/paphos/physiotherapist" },
      { city: "Larnaca", specialty: "Dentists", path: "/larnaca/dentist" },
      { city: "Larnaca", specialty: "Dermatologists", path: "/larnaca/dermato-venereology" },
      { city: "Larnaca", specialty: "Physiotherapists", path: "/larnaca/physiotherapist" },
    ] as const;

    const missingResults: string[] = [];

    for (const search of footerSearches) {
      await page.goto("/");
      await expect(
        page.getByRole("heading", {
          level: 2,
          name: /Popular Healthcare Searches in Cyprus/i,
        })
      ).toBeVisible();

      const isSmallViewport = (page.viewportSize()?.width ?? 1024) < 768;
      if (isSmallViewport) {
        const summary = page.getByText("Explore by city and specialty", { exact: true });
        if ((await summary.count()) > 0) {
          await summary.first().click();
        }
      }

      const linkLabel = `${search.specialty} in ${search.city}`;
      const link = page.getByRole("link", { name: linkLabel }).first();
      if ((await link.count()) === 0) {
        missingResults.push(`${linkLabel} (missing link)`);
        continue;
      }
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${search.path}(?:\\?|$)`), {
        timeout: 20_000,
      });
      await expect(page.getByTestId("finder-active-filters")).toContainText(search.city, {
        timeout: 20_000,
      });
      await expect(page.getByRole("button", { name: /^Clear$/i })).toBeVisible();

      const cardsCount = await page.locator("section.mt-6 article").count();
      const invitationCardVisible = await page
        .getByTestId("finder-missing-doctor-card")
        .isVisible()
        .catch(() => false);
      if (cardsCount === 0 || invitationCardVisible) {
        missingResults.push(linkLabel);
      }
    }

    expect(
      missingResults,
      `Quick links without results: ${missingResults.length > 0 ? missingResults.join(", ") : "none"}`
    ).toEqual([]);
  });

  test("manual directory landing page loads for known slug @pr-e2e", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Run once on desktop.",
    );

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const { data: sample, error } = await admin
      .from("directory_manual")
      .select("slug, name")
      .eq("is_archived", false)
      .eq("finder_visible", true)
      .not("slug", "is", null)
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !sample?.slug || !sample?.name) {
      test.skip(true, `No finder-visible manual directory slug available: ${error?.message ?? "empty"}`);
      return;
    }

    const slug = String(sample.slug);
    const name = String(sample.name);
    const namePattern = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    await page.goto(`/finder/professional/${slug}`);
    await expect(page).toHaveTitle(namePattern);
    await expect(page.getByRole("heading", { level: 1, name: namePattern })).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Directory listing/i }).locator("article"),
    ).toBeVisible();
  });

  test("landing to finder shows complete unfiltered directory results", async ({ page }) => {
    test.setTimeout(120_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);

    const doctorsRes = await fetchAllSupabaseRows(() =>
      admin
        .from("doctors")
        .select("id, name, slug, status, is_test_profile, email")
        .eq("status", "verified")
        .not("slug", "is", null)
        .order("name", { ascending: true }),
    );

    if (doctorsRes.error) {
      throw new Error(`Failed reading doctors for finder count: ${doctorsRes.error.message}`);
    }

    const { count: manualCount, error: manualCountError } = await admin
      .from("directory_manual")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false)
      .eq("finder_visible", true);

    if (manualCountError) {
      throw new Error(`Failed reading directory_manual for finder count: ${manualCountError.message}`);
    }

    const expectedRegistered = (doctorsRes.data ?? []).filter((row) => {
      if (finderIncludesRegisteredTestProfiles()) {
        return true;
      }
      return !isTestProfileLike({
        name: String(row.name ?? ""),
        slug: row.slug,
        email: (row as { email?: string | null }).email ?? null,
        isTestProfile: Boolean((row as { is_test_profile?: boolean | null }).is_test_profile),
      });
    }).length;
    const expectedManual = manualCount ?? 0;
    const expectedTotal = expectedRegistered + expectedManual;

    await page.goto("/for-professionals");
    const finderLink = page.getByRole("link", { name: /^Find a Professional$/i }).first();
    await expect(finderLink).toBeVisible();
    await Promise.all([
      page.waitForURL(/^https?:\/\/[^/?#]+\/?(?:\?.*)?$/, { timeout: 20_000 }),
      finderLink.click(),
    ]);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Find your next health professional in Cyprus|Health Professionals in Cyprus|Find a Professional/i,
      })
    ).toBeVisible();
    const resultsCount = page.getByTestId("finder-results-count");
    await expect(resultsCount).toBeVisible({ timeout: 60_000 });
    await expect(resultsCount).toContainText(String(expectedTotal));
    // First page only renders a page-size slice; do not expect every row in the DOM.
    const cardCount = await page.locator("section.mt-6 article").count();
    expect(cardCount).toBeGreaterThan(0);
    expect(cardCount).toBeLessThanOrEqual(Math.min(expectedTotal, FINDER_RESULTS_PAGE_SIZE));
  });

  test("registered card renders avatar, languages and profile links to booking page", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let created: CreatedDoctor | null = null;

    try {
      created = await createVerifiedDoctor(admin, nonce, {
        slugPrefix: "qa-card",
        name: `Finder Card ${nonce}`,
        specialty: "Dentistry",
        district: "Paphos",
        languages: ["Greek", "English"],
        avatarPath: `profiles/qa-card-${nonce}/avatar.jpg`,
      });

      await page.goto(`/paphos/dentist?name=${encodeURIComponent(created.name)}`);
      const card = page
        .locator("section.mt-6 article")
        .filter({ has: page.getByText(created.name, { exact: true }) })
        .first();

      await expect(card).toBeVisible({ timeout: 20000 });
      await expect(card.getByText("Speaks", { exact: true })).toBeVisible();
      await expect(card.getByText("Greek", { exact: true })).toBeVisible();
      await expect(card.getByText("English", { exact: true })).toBeVisible();
      await expect(card.getByRole("link", { name: created.name, exact: true })).toHaveAttribute(
        "href",
        `/${created.slug}`,
      );
      await expect(
        card.getByRole("link", { name: `View ${created.name} booking page` }),
      ).toHaveAttribute("href", `/${created.slug}`);

      const avatar = card.locator("img").first();
      await expect(avatar).toHaveAttribute("src", new RegExp(`profiles/qa-card-${nonce}/avatar.jpg`));
    } finally {
      if (created) {
        await admin.from("doctors").delete().eq("id", created.doctorId);
        await admin.auth.admin.deleteUser(created.authUserId);
      }
    }
  });

  test("finder card strips common doctor title prefixes from displayed name", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const created: CreatedDoctor[] = [];

    try {
      const cases = [
        { input: `Dr. Prefix Cleanup ${nonce}`, expected: `Prefix Cleanup ${nonce}`, slugPrefix: "finder-prefix-dr-dot" },
        { input: `Dr Prefix Cleanup ${nonce}`, expected: `Prefix Cleanup ${nonce}`, slugPrefix: "qa-prefix-dr" },
        { input: `Doctor Prefix Cleanup ${nonce}`, expected: `Prefix Cleanup ${nonce}`, slugPrefix: "qa-prefix-doctor" },
      ] as const;

      for (const testCase of cases) {
        created.push(
          await createVerifiedDoctor(admin, `${nonce}-${testCase.slugPrefix}`, {
            slugPrefix: testCase.slugPrefix,
            name: testCase.input,
            specialty: "Dentistry",
            district: "Nicosia",
            languages: ["English"],
          })
        );
      }

      await page.goto(`/nicosia/dentist?name=${encodeURIComponent(`Prefix Cleanup ${nonce}`)}`);
      for (const testCase of cases) {
        const card = page
          .locator("section.mt-6 article")
          .filter({ has: page.getByText(testCase.expected, { exact: true }) })
          .first();
        await expect(card).toBeVisible({ timeout: 20000 });
        await expect(card.getByText(testCase.expected, { exact: true })).toBeVisible();
        await expect(card.getByText(testCase.input, { exact: true })).toHaveCount(0);
      }
    } finally {
      for (const doctor of created) {
        await admin.from("doctors").delete().eq("id", doctor.doctorId);
        await admin.auth.admin.deleteUser(doctor.authUserId);
      }
    }
  });

  test("finder apply/reset filters updates results for registered professionals", async ({ page }) => {
    // Full unfiltered finder now loads the entire directory (no 600-row cap).
    test.setTimeout(120_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const created: CreatedDoctor[] = [];

    try {
      created.push(
        await createVerifiedDoctor(admin, `${nonce}-a`, {
          slugPrefix: "finder-filter-a",
          name: `Finder Filter A ${nonce}`,
          specialty: "Dentistry",
          district: "Nicosia",
          languages: ["English"],
        })
      );
      created.push(
        await createVerifiedDoctor(admin, `${nonce}-b`, {
          slugPrefix: "finder-filter-b",
          name: `Finder Filter B ${nonce}`,
          specialty: "Dermatology",
          district: "Limassol",
          languages: ["Greek"],
        })
      );

      await page.goto("/");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /Find your next health professional in Cyprus|Health Professionals in Cyprus|Find a Professional/i,
        })
      ).toBeVisible({
        timeout: 60_000,
      });

      const districtSelect = page.getByLabel("District");
      const showResults = page.getByRole("button", { name: /^Find$/i });
      await districtSelect.selectOption("Nicosia");
      await showResults.click();
      await expect(page).toHaveURL(/\/nicosia(?:\?|$)/, { timeout: 60_000 });
      await expect(page.getByTestId("finder-active-filters")).toContainText("Nicosia");

      const specialtySelect = page.getByLabel("Specialty");
      await expect(specialtySelect).toBeEnabled({ timeout: 30_000 });
      await expect(specialtySelect.locator('option[value="dentist"]')).toHaveCount(1, {
        timeout: 60_000,
      });
      await specialtySelect.selectOption("dentist");
      await showResults.click();
      await expect(page).toHaveURL(/\/nicosia\/dentist(?:\?|$)/, { timeout: 60_000 });
      await expect(page.getByTestId("finder-active-filters")).toContainText("Dentist");

      await expect(page.getByText(created[0].name, { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(created[1].name, { exact: true })).toHaveCount(0);

      await page.getByRole("button", { name: /^Clear$/i }).click();
      await expect(page).toHaveURL(/^https?:\/\/[^/?#]+\/?(?:\?.*)?$/, { timeout: 60_000 });
      await expect(page.getByTestId("finder-active-filters")).toHaveCount(0);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /Find your next health professional in Cyprus|Health Professionals in Cyprus|Find a Professional/i,
        }),
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(created[0].name, { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible({ timeout: 60_000 });
    } finally {
      for (const doctor of created) {
        await admin.from("doctors").delete().eq("id", doctor.doctorId);
        await admin.auth.admin.deleteUser(doctor.authUserId);
      }
    }
  });

  test("test profile card pins shared availability week nav on scroll", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");
    test.skip(
      !finderIncludesRegisteredTestProfiles(),
      "NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES is not enabled.",
    );

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let created: CreatedDoctor | null = null;

    try {
      created = await createVerifiedDoctor(admin, nonce, {
        slugPrefix: "finder-card-avail",
        name: `Avail Sticky ${nonce}`,
        specialty: "Dentistry",
        district: "Paphos",
        languages: ["English"],
      });
      await seedWeekdayAvailabilitySettings(admin, created.doctorId);

      await page.goto(
        `/paphos/dentist?name=${encodeURIComponent(created.name)}`,
      );
      const card = page
        .locator("section.mt-6 article")
        .filter({ has: page.getByText(created.name, { exact: true }) })
        .first();

      await expect(card).toBeVisible({ timeout: 20000 });
      await expect(card.getByTestId("finder-card-calendar-preview")).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByTestId("finder-availability-week-nav")).toBeVisible();
      await expect(card.getByRole("button", { name: /Show next week/i })).toBeVisible();

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.locator("[data-finder-sticky-week-anchor]").scrollIntoViewIfNeeded();
      for (let step = 0; step < 40; step += 1) {
        await page.mouse.wheel(0, 200);
        if ((await page.getByTestId("finder-availability-week-nav-pinned").count()) > 0) {
          break;
        }
      }

      await expect(page.getByTestId("finder-availability-week-nav-pinned")).toBeVisible({
        timeout: 5000,
      });
      await expect(
        page
          .getByTestId("finder-availability-week-nav-pinned")
          .getByRole("button", { name: /Show next week/i }),
      ).toBeVisible();
    } finally {
      if (created) {
        await admin.from("doctor_settings").delete().eq("doctor_id", created.doctorId);
        await admin.from("doctors").delete().eq("id", created.doctorId);
        await admin.auth.admin.deleteUser(created.authUserId);
      }
    }
  });
});

