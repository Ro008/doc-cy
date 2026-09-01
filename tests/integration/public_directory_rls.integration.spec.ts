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
      .from("directory_manual")
      .select("email, ghs_code, gender, name, phone")
      .limit(1);
    expect(isDeniedOrEmpty(manualDump)).toBe(true);

    const manualPublicDump = await anon
      .from("directory_manual_public")
      .select("id, name, specialty, phone, slug")
      .limit(5);
    expect(isDeniedOrEmpty(manualPublicDump)).toBe(true);

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

    // Service role still reads views for SSR / trusted servers.
    test.skip(!serviceKey, "Missing SUPABASE_SERVICE_ROLE_KEY for positive control.");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceManual = await admin
      .from("directory_manual_public")
      .select("id, name")
      .limit(1);
    expect(serviceManual.error).toBeNull();
  });
});
