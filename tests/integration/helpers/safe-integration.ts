import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test } from "@playwright/test";

export type SafeIntegrationEnv = {
  supabaseUrl: string;
  serviceRole: string;
  internalSecret: string;
};

type Options = {
  needsInternalSecret?: boolean;
};

/** Skips the current test when integration env is unsafe or incomplete. */
export function requireSafeIntegration(options: Options = {}): SafeIntegrationEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const internalSecret = process.env.INTERNAL_DIRECTORY_SECRET ?? "";
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
  if (options.needsInternalSecret && !internalSecret) {
    test.skip(true, "Missing INTERNAL_DIRECTORY_SECRET.");
  }

  return { supabaseUrl, serviceRole, internalSecret };
}

export function createIntegrationAdmin(env: SafeIntegrationEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRole);
}
