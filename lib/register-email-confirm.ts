import type { SupabaseClient } from "@supabase/supabase-js";
import { isAllowedPasswordResetOrigin } from "@/lib/password-reset";

export const REGISTER_EMAIL_CONFIRM_PATH = "/auth/confirm-email";
export const REGISTER_EMAIL_CONFIRMED_QUERY = "email";
export const REGISTER_EMAIL_CONFIRMED_VALUE = "confirmed";

export function isRegisterEmailConfirmPath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.split("#")[0] || pathname;
  const normalized = path.replace(/\/$/, "") || "/";
  return (
    normalized === REGISTER_EMAIL_CONFIRM_PATH ||
    normalized.startsWith(`${REGISTER_EMAIL_CONFIRM_PATH}/`)
  );
}

export function registerEmailConfirmCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${REGISTER_EMAIL_CONFIRM_PATH}`;
}

/** One-time link in the DocCy (Resend) signup email — verified in `/auth/confirm-email`. */
export function registerEmailConfirmVerifyUrl(origin: string, tokenHash: string): string {
  const params = new URLSearchParams();
  params.set("token_hash", tokenHash);
  params.set("type", "magiclink");
  return `${registerEmailConfirmCallbackUrl(origin)}?${params.toString()}`;
}

export function registerSubmittedEmailConfirmedPath(claimed: boolean): string {
  const params = new URLSearchParams();
  params.set("submitted", "1");
  params.set(REGISTER_EMAIL_CONFIRMED_QUERY, REGISTER_EMAIL_CONFIRMED_VALUE);
  if (claimed) params.set("claimed", "1");
  return `/register?${params.toString()}`;
}

export function registerSubmittedEmailConfirmErrorPath(): string {
  return "/register?submitted=1&error=email_confirm";
}

/**
 * Prefer our `/auth/confirm-email?token_hash=` URL; fall back to GoTrue's action_link.
 */
export function registerEmailConfirmLinkFromGenerateLink(
  origin: string,
  properties: {
    hashed_token?: string;
    hashedToken?: string;
    action_link?: string;
    actionLink?: string;
  } | null | undefined,
): string | null {
  const tokenHash = String(properties?.hashed_token || properties?.hashedToken || "").trim();
  if (tokenHash) return registerEmailConfirmVerifyUrl(origin, tokenHash);
  const actionLink = String(properties?.action_link || properties?.actionLink || "").trim();
  return actionLink || null;
}

/** Host for the confirm link in the Resend email (must be allowlisted in Supabase Auth). */
export function resolveRegisterEmailConfirmOrigin(): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "",
    process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//, "")}`
      : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (isAllowedPasswordResetOrigin(candidate)) return candidate;
  }
  if (process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production") {
    return "http://localhost:3000";
  }
  return null;
}

/** Best-effort magic link for the signup Resend email. Never throws. */
export async function generateRegisterEmailConfirmUrl(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const origin = resolveRegisterEmailConfirmOrigin();
  if (!origin) {
    console.error("[DocCy] register email confirm skipped: no allowed origin");
    return null;
  }
  const redirectTo = registerEmailConfirmCallbackUrl(origin);
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (error) {
      console.error("[DocCy] register email confirm generateLink failed", error.message);
      return null;
    }
    return registerEmailConfirmLinkFromGenerateLink(origin, data?.properties);
  } catch (error) {
    console.error("[DocCy] register email confirm generateLink threw", error);
    return null;
  }
}
