import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test } from "@playwright/test";

export type SafeIntegrationEnv = {
  supabaseUrl: string;
  serviceRole: string;
};

/** Skips the current test when integration env is unsafe or incomplete. */
export function requireSafeIntegration(): SafeIntegrationEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
  const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";

  const normalizeUrl = (u: string) => u.replace(/\/+$/, "");
  const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
  const integrationSupabase = normalizeUrl(supabaseUrl);
  const usingProductionSupabase =
    prodSupabase.length > 0 && integrationSupabase === prodSupabase;
  const unsafeBase = /mydoccy\.com/i.test(baseUrl);

  if (!safeEnv || unsafeBase || usingProductionSupabase) {
    test.skip(true, "Unsafe target or missing INTEGRATION_SAFE_ENV.");
  }
  if (!baseUrl || !supabaseUrl || !serviceRole) {
    test.skip(true, "Missing integration env vars.");
  }

  return { supabaseUrl, serviceRole };
}

export function createIntegrationAdmin(env: SafeIntegrationEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRole);
}
