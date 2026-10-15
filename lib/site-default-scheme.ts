import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { cookies } from "next/headers";

import {
  parseDefaultScheme,
  PROFILE_SCHEME_COOKIE,
  readSchemeCookie,
  type ProfileScheme,
} from "@/lib/profile-scheme";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * The public site's default Light / Dark mode, `app_settings.public_default_scheme`
 * ("light" or "dark", checked by the database too). It applies to visitors who have
 * not picked one; founders change it in the internal dashboard.
 * `app_settings` is service role only (RLS on, no policies).
 */

export const PUBLIC_DEFAULT_SCHEME_KEY = "public_default_scheme";
export const PUBLIC_DEFAULT_SCHEME_TAG = "public-default-scheme";

export type DefaultSchemeResult = { ok: true; scheme: ProfileScheme } | { ok: false; error: string };

export async function loadDefaultScheme(service: SupabaseClient): Promise<DefaultSchemeResult> {
  const { data, error } = await service
    .from("app_settings")
    .select("value")
    .eq("key", PUBLIC_DEFAULT_SCHEME_KEY)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const scheme = parseDefaultScheme(data?.value);
  if (scheme == null) return { ok: false, error: "public_default_scheme is missing or invalid" };
  return { ok: true, scheme };
}

export async function saveDefaultScheme(
  service: SupabaseClient,
  scheme: ProfileScheme,
  adminId: string,
): Promise<DefaultSchemeResult> {
  const { data, error } = await service
    .from("app_settings")
    .update({ value: scheme, updated_at: new Date().toISOString(), updated_by: adminId })
    .eq("key", PUBLIC_DEFAULT_SCHEME_KEY)
    .select("value")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const saved = parseDefaultScheme(data?.value);
  if (saved == null) return { ok: false, error: "public_default_scheme row not found" };
  return { ok: true, scheme: saved };
}

// Read at most every 5 minutes, not on every page; a founder's save clears it at once.
// A missing row is light, like any value. A failed read is not cached (it throws), so
// the next page tries again.
const cachedDefaultScheme = unstable_cache(
  async (): Promise<ProfileScheme> => {
    const service = createServiceRoleClient();
    if (!service) throw new Error("service role client not configured");
    const { data, error } = await service
      .from("app_settings")
      .select("value")
      .eq("key", PUBLIC_DEFAULT_SCHEME_KEY)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return parseDefaultScheme(data?.value) ?? "light";
  },
  [PUBLIC_DEFAULT_SCHEME_TAG],
  { revalidate: 300, tags: [PUBLIC_DEFAULT_SCHEME_TAG] },
);

/** The founders' default; light whenever it cannot be read. Asked once per request. */
export const getSiteDefaultScheme = cache(async (): Promise<ProfileScheme> => {
  const scheme = await cachedDefaultScheme().catch((error: unknown) => {
    console.error("[public-default-scheme] load failed", error);
    return null;
  });
  return scheme ?? "light";
});

/** This visitor's mode for a public page: their own choice, else the founders' default. */
export async function getSiteScheme(): Promise<ProfileScheme> {
  const own = readSchemeCookie(cookies().get(PROFILE_SCHEME_COOKIE)?.value);
  return own ?? (await getSiteDefaultScheme());
}
