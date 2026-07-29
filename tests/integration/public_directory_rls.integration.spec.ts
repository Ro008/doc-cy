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

test.describe("Integration: public directory RLS hardening", () => {
  test("anon cannot read PII columns from base tables; public views still work", async () => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!supabaseUrl || !anonKey, "Missing integration env vars.");

    const anon = createClient(supabaseUrl, anonKey);

    const doctorsDump = await anon.from("doctors").select("email, phone").limit(1);
    expect(doctorsDump.error).toBeNull();
    expect(doctorsDump.data ?? []).toHaveLength(0);

    const manualDump = await anon
      .from("directory_manual")
      .select("email, ghs_code, gender")
      .limit(1);
    expect(manualDump.error).toBeNull();
    expect(manualDump.data ?? []).toHaveLength(0);

    const doctorsPublic = await anon
      .from("doctors_public")
      .select("id, slug, name, phone")
      .eq("status", "verified")
      .not("slug", "is", null)
      .limit(1)
      .maybeSingle();

    expect(doctorsPublic.error).toBeNull();
    expect(doctorsPublic.data?.slug).toBeTruthy();

    const manualPublic = await anon
      .from("directory_manual_public")
      .select("id, name, specialty, phone")
      .limit(1)
      .maybeSingle();

    expect(manualPublic.error).toBeNull();
    expect(manualPublic.data?.name).toBeTruthy();
  });
});
