import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

function assertSafeIntegrationTarget(baseUrl: string, supabaseUrl: string): string | null {
  const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";
  const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
  const integrationSupabase = normalizeUrl(supabaseUrl);
  const usingProductionSupabase =
    prodSupabase.length > 0 && integrationSupabase === prodSupabase;
  const unsafeBase = /mydoccy\.com/i.test(baseUrl);
  if (!safeEnv || unsafeBase || usingProductionSupabase) {
    return "Unsafe target or missing INTEGRATION_SAFE_ENV.";
  }
  return null;
}

function isDeniedOrEmpty(result: {
  data: unknown;
  error: { message?: string; code?: string } | null;
}): boolean {
  if (result.error) return true;
  const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
  return rows.length === 0;
}

test.describe("Integration: public directory RLS hardening", () => {
  test("anon cannot dump base tables or public directory views", async () => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!supabaseUrl || !anonKey, "Missing integration env vars.");

    const anon = createClient(supabaseUrl, anonKey);

    const doctorsDump = await anon.from("professionals").select("email, phone").limit(1);
    expect(isDeniedOrEmpty(doctorsDump)).toBe(true);

    const manualDump = await anon
      .from("professionals")
      .select("email, ghs_code, gender, name, phone")
      .eq("is_registered", false)
      .limit(1);
    expect(isDeniedOrEmpty(manualDump)).toBe(true);

    // Specialty rows carry licence numbers: service role only.
    const specialtyRowsDump = await anon
      .from("professional_specialties")
      .select("professional_id, specialty, license_number")
      .limit(5);
    expect(isDeniedOrEmpty(specialtyRowsDump)).toBe(true);

    // Admin accounts: service role only. Expect a permission error, not an empty
    // result, so the test also fails if the table is missing or a grant comes back.
    const adminUsersRead = await anon.from("admin_users").select("id, email").limit(1);
    expect(adminUsersRead.error?.code).toBe("42501");
    const adminUsersInsert = await anon.from("admin_users").insert({
      auth_user_id: "00000000-0000-0000-0000-000000000000",
      name: "Anon",
      email: "anon@example.com",
    });
    expect(adminUsersInsert.error?.code).toBe("42501");

    // Review requests (permanent audit log): service role only, tables and functions.
    const requestLogRead = await anon.from("request_log").select("id").limit(1);
    expect(requestLogRead.error?.code).toBe("42501");
    const requestTypesRead = await anon.from("request_types").select("name").limit(1);
    expect(requestTypesRead.error?.code).toBe("42501");
    const requestSubmit = await anon.rpc("request_submit", {
      p_request_type: "professional_registration",
      p_professional_id: "00000000-0000-0000-0000-000000000000",
      p_details: {},
      p_details_version: 1,
    });
    expect(requestSubmit.error?.code).toBe("42501");

    // SECURITY DEFINER RPCs that must not be callable with the anon key. Expect a
    // permission error, not just an empty result: a random id would return nothing
    // even if the grant came back.
    const anyId = "00000000-0000-0000-0000-000000000000";
    const occupiedRpc = await anon.rpc("public_doctor_occupied_datetimes", {
      p_doctor_id: anyId,
      p_from: new Date().toISOString(),
      p_to: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(occupiedRpc.error?.code).toBe("42501");
    const ownerRpc = await anon.rpc("is_doctor_owner", { p_doctor_id: anyId });
    expect(ownerRpc.error?.code).toBe("42501");

    const professionalsPublicDump = await anon
      .from("professionals_public")
      .select("id, name, specialty, phone, slug")
      .limit(5);
    expect(isDeniedOrEmpty(professionalsPublicDump)).toBe(true);

    const clinicsPublicDump = await anon
      .from("clinics_public")
      .select("id, name, phone, slug")
      .limit(5);
    expect(isDeniedOrEmpty(clinicsPublicDump)).toBe(true);

    const doctorsPublicDump = await anon
      .from("doctors_public")
      .select("id, slug, name, phone")
      .limit(5);
    expect(isDeniedOrEmpty(doctorsPublicDump)).toBe(true);

    // The *_public views above are dropped, not merely ungranted: the probes stay as a
    // regression guard that they are never recreated. SSR now reads `professionals`
    // directly through the service role, so that is the positive control.
    test.skip(!serviceKey, "Missing SUPABASE_SERVICE_ROLE_KEY for positive control.");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceProfessionals = await admin
      .from("professionals")
      .select("id, name")
      .eq("is_registered", true)
      .eq("is_archived", false)
      .limit(1);
    expect(serviceProfessionals.error).toBeNull();
  });
});
