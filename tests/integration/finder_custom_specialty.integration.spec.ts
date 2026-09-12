import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { finderIncludesRegisteredTestProfiles } from "@/lib/doctor-test-profile";

/**
 * Karina / Sexology regression: a verified professional with Psychology (master)
 * plus approved custom Sexology must appear when a patient clicks the Sexology
 * profile pill, and Sexology must be a real dropdown option (not a ghost URL).
 */

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

async function createPsychologyPlusSexologyDoctor(
  admin: ReturnType<typeof createClient>,
  nonce: string,
): Promise<CreatedDoctor> {
  const slugPrefix = "finder-filter-sexology";
  const email = `${slugPrefix}-${nonce}@test-doccy.com.cy`;
  const slug = `${slugPrefix}-${nonce}`;
  const name = `Finder Filter Sexology ${nonce}`;

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
    .from("professionals")
    .insert({
      auth_user_id: authUserId,
      name,
      specialty: "Psychology",
      specialties: ["Psychology", "Sexology"],
      district: "Paphos",
      town: "Paphos",
      email,
      phone: "+35799123456",
      languages: ["English"],
      license_number: `LIC-FINDER-SEX-${nonce}`,
      license_file_url: `licenses/integration/${nonce}-${slugPrefix}.pdf`,
      status: "verified",
      slug,
      is_specialty_approved: true,
      is_test_profile: true,
      is_registered: true,
      has_online_booking: true,
      finder_visible: true,
      is_archived: false,
      subscription_tier: "standard",
    })
    .select("id")
    .single();

  if (doctorInsert.error || !doctorInsert.data?.id) {
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed creating doctor row: ${doctorInsert.error?.message}`);
  }

  const doctorId = String(doctorInsert.data.id);
  const specialtyUpsert = await admin.from("doctor_specialties").upsert(
    [
      {
        doctor_id: doctorId,
        specialty: "Psychology",
        license_number: `LIC-FINDER-SEX-${nonce}-psy`,
        is_approved: true,
      },
      {
        doctor_id: doctorId,
        specialty: "Sexology",
        license_number: `LIC-FINDER-SEX-${nonce}-sex`,
        is_approved: true,
      },
    ],
    { onConflict: "doctor_id,specialty" },
  );
  if (specialtyUpsert.error) {
    await admin.from("professionals").delete().eq("id", doctorId);
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed creating doctor_specialties: ${specialtyUpsert.error.message}`);
  }

  const verify = await admin
    .from("professionals")
    .select("specialty, specialties")
    .eq("id", doctorId)
    .single();
  const specialties = Array.isArray(verify.data?.specialties) ? verify.data.specialties : [];
  if (verify.error || !specialties.includes("Sexology") || !specialties.includes("Psychology")) {
    await admin.from("doctor_specialties").delete().eq("doctor_id", doctorId);
    await admin.from("professionals").delete().eq("id", doctorId);
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error(
      `Expected Psychology + Sexology on professionals.specialties, got ${JSON.stringify(verify.data)}`,
    );
  }

  return { doctorId, authUserId, slug, name };
}

test.describe("Integration: custom specialty finder (Sexology)", { tag: ["@pr-e2e", "@pr-e2e-finder"] }, () => {
  test("profile Sexology pill lists the professional and selects Sexology in the dropdown", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Run this matrix only once on desktop.",
    );
    test.setTimeout(120_000);

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
      created = await createPsychologyPlusSexologyDoctor(admin, nonce);

      await page.goto(`/en/${created.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(created.name, {
        timeout: 30_000,
      });

      const sexologyPill = page.getByLabel("Specialties").getByRole("link", {
        name: "Sexology",
        exact: true,
      });
      await expect(sexologyPill).toBeVisible();
      await expect(sexologyPill).toHaveAttribute("href", "/paphos/sexology");
      await sexologyPill.click();

      await expect(page).toHaveURL(/\/paphos\/sexology(?:\?|$)/, { timeout: 60_000 });
      await expect(page.getByRole("heading", { level: 1, name: /Sexology in Paphos/i })).toBeVisible({
        timeout: 60_000,
      });

      const specialtySelect = page.getByLabel("Specialty");
      await expect(specialtySelect.locator('option[value="sexology"]')).toHaveText("Sexology", {
        timeout: 20_000,
      });
      await expect(specialtySelect).toHaveValue("sexology");

      await expect(page.getByRole("link", { name: created.name, exact: true })).toBeVisible({
        timeout: 60_000,
      });
    } finally {
      if (created) {
        await admin.from("doctor_specialties").delete().eq("doctor_id", created.doctorId);
        await admin.from("professionals").delete().eq("id", created.doctorId);
        await admin.auth.admin.deleteUser(created.authUserId);
      }
    }
  });
});
