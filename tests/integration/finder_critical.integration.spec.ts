import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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
  const email = `${input.slugPrefix}-${nonce}@integration.test`;
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

test.describe("Integration: finder business-critical UX", () => {
  test("footer popular quick links should lead to non-empty finder results", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Run this matrix only once on desktop to avoid mobile timeout noise."
    );
    test.setTimeout(180000);

    const footerSearches = [
      { city: "Nicosia", specialty: "Dentists", path: "/finder/nicosia/dentistry" },
      { city: "Nicosia", specialty: "Physiotherapists", path: "/finder/nicosia/physiotherapy" },
      { city: "Nicosia", specialty: "Psychologists", path: "/finder/nicosia/psychology" },
      { city: "Nicosia", specialty: "Dermatologists", path: "/finder/nicosia/dermatology" },
      { city: "Limassol", specialty: "Dentists", path: "/finder/limassol/dentistry" },
      { city: "Limassol", specialty: "Physiotherapists", path: "/finder/limassol/physiotherapy" },
      { city: "Limassol", specialty: "Psychologists", path: "/finder/limassol/psychology" },
      { city: "Limassol", specialty: "Dermatologists", path: "/finder/limassol/dermatology" },
      { city: "Paphos", specialty: "Dentists", path: "/finder/paphos/dentistry" },
      { city: "Paphos", specialty: "Physiotherapists", path: "/finder/paphos/physiotherapy" },
      { city: "Paphos", specialty: "Psychologists", path: "/finder/paphos/psychology" },
      { city: "Paphos", specialty: "Dermatologists", path: "/finder/paphos/dermatology" },
      { city: "Larnaca", specialty: "Dentists", path: "/finder/larnaca/dentistry" },
      { city: "Larnaca", specialty: "Physiotherapists", path: "/finder/larnaca/physiotherapy" },
      { city: "Larnaca", specialty: "Psychologists", path: "/finder/larnaca/psychology" },
      { city: "Larnaca", specialty: "Dermatologists", path: "/finder/larnaca/dermatology" },
    ] as const;

    const missingResults: string[] = [];

    for (const search of footerSearches) {
      await page.goto("/finder");
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
      await expect(page).toHaveURL(new RegExp(`${search.path}(?:\\?|$)`));

      const cardsCount = await page.locator("section.mt-6 article").count();
      const emptyStateVisible = await page
        .getByText(/No professionals match these filters\./i)
        .first()
        .isVisible()
        .catch(() => false);
      if (cardsCount === 0 || emptyStateVisible) {
        missingResults.push(linkLabel);
      }
    }

    expect(
      missingResults,
      `Quick links without results: ${missingResults.length > 0 ? missingResults.join(", ") : "none"}`
    ).toEqual([]);
  });

  test("landing to finder shows complete unfiltered directory results", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);

    const doctorsRes = await admin
      .from("doctors")
      .select("id, name, slug, status, is_test_profile")
      .eq("status", "verified")
      .not("slug", "is", null)
      .limit(1000);

    if (doctorsRes.error) {
      throw new Error(`Failed reading doctors for finder count: ${doctorsRes.error.message}`);
    }

    const manualRes = await admin
      .from("directory_manual")
      .select("id")
      .eq("is_archived", false)
      .limit(600);

    if (manualRes.error) {
      throw new Error(`Failed reading directory_manual for finder count: ${manualRes.error.message}`);
    }

    const expectedRegistered = (doctorsRes.data ?? []).filter((row) => {
      const isExplicitTest = Boolean((row as { is_test_profile?: boolean | null }).is_test_profile);
      if (isExplicitTest) return false;
      return !/\btest\b/i.test(String(row.name ?? ""));
    }).length;
    const expectedManual = (manualRes.data ?? []).length;
    const expectedTotal = expectedRegistered + expectedManual;

    await page.goto("/");
    const finderLink = page.getByRole("link", { name: /^Find a Professional$/i }).first();
    await expect(finderLink).toBeVisible();
    await finderLink.click();

    await expect(page).toHaveURL(/\/finder(?:\?|$)/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Health Professionals in Cyprus|Find a Professional/i,
      })
    ).toBeVisible();
    await expect(page.locator("section.mt-6 article")).toHaveCount(expectedTotal, { timeout: 20000 });
  });

  test("registered card renders avatar, languages and Book Online slug CTA", async ({ page }) => {
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
        slugPrefix: "finder-card",
        name: `Finder Card ${nonce}`,
        specialty: "Dentistry",
        district: "Paphos",
        languages: ["Greek", "English"],
        avatarPath: `profiles/finder-card-${nonce}/avatar.jpg`,
      });

      await page.goto("/finder/paphos/dentistry");
      const card = page
        .locator("section.mt-6 article")
        .filter({ has: page.getByText(created.name, { exact: true }) })
        .first();

      await expect(card).toBeVisible({ timeout: 20000 });
      await expect(card.getByText("Speaks", { exact: true })).toBeVisible();
      await expect(card.getByText("Greek", { exact: true })).toBeVisible();
      await expect(card.getByText("English", { exact: true })).toBeVisible();
      await expect(card.getByRole("link", { name: /Book Online/i })).toHaveAttribute(
        "href",
        `/${created.slug}`
      );

      const avatar = card.locator("img").first();
      await expect(avatar).toHaveAttribute("src", new RegExp(`profiles/finder-card-${nonce}/avatar.jpg`));
    } finally {
      if (created) {
        await admin.from("doctors").delete().eq("id", created.doctorId);
        await admin.auth.admin.deleteUser(created.authUserId);
      }
    }
  });

  test("finder apply/reset filters updates results for registered professionals", async ({ page }) => {
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

      await page.goto("/finder");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /Health Professionals in Cyprus|Find a Professional/i,
        })
      ).toBeVisible({
        timeout: 20000,
      });

      const districtSelect = page.getByLabel("District");
      await districtSelect.selectOption("Nicosia");

      const specialtyInput = page.getByLabel("Specialty");
      await specialtyInput.fill("Dentistry");
      await page.waitForTimeout(600);

      await expect(page).toHaveURL(/\/finder\/nicosia\/dentistry(?:\?|$)/);
      await expect(page.getByText(created[0].name, { exact: true })).toBeVisible();
      await expect(page.getByText(created[1].name, { exact: true })).toHaveCount(0);

      await page.getByRole("button", { name: /Clear all filters|Reset/i }).click();
      await expect(page).toHaveURL(/\/finder(?:\?|$)/);
      await expect(page.getByText(created[0].name, { exact: true })).toBeVisible();
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible();
    } finally {
      for (const doctor of created) {
        await admin.from("doctors").delete().eq("id", doctor.doctorId);
        await admin.auth.admin.deleteUser(doctor.authUserId);
      }
    }
  });
});

