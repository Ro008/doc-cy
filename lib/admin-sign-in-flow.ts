/**
 * Decisions for the /internal admin sign-in page, free of React and Supabase so
 * they can be unit tested. The page asks the server for the admin's access
 * (`/api/internal/session`) and shows the step this returns.
 */
import type { AdminAccessDenial } from "@/lib/admin-auth-core";

export const ADMIN_SIGN_IN_PATH = "/internal/sign-in";
export const ADMIN_HOME_PATH = "/internal/directory";

/** Only same-site paths under /internal/ (never the sign-in page itself). */
export function safeInternalNextPath(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/internal/")) return ADMIN_HOME_PATH;
  if (value.startsWith("//") || value.includes("\\") || value.includes("/../") || value.includes("/./")) {
    return ADMIN_HOME_PATH;
  }
  const path = value.split(/[?#]/)[0];
  if (path === ADMIN_SIGN_IN_PATH || path.startsWith(`${ADMIN_SIGN_IN_PATH}/`)) return ADMIN_HOME_PATH;
  return value;
}

export function adminSignInPath(next?: string | null): string {
  const safe = safeInternalNextPath(next);
  if (!next || safe !== next) return ADMIN_SIGN_IN_PATH;
  return `${ADMIN_SIGN_IN_PATH}?next=${encodeURIComponent(safe)}`;
}

export type AuthHash =
  | { kind: "session"; accessToken: string; refreshToken: string; type: string }
  | { kind: "error"; code: string; description: string };

/**
 * Supabase email links (invite, recovery) land with the session or an error in
 * the URL hash. The app's browser client uses the PKCE flow and ignores these,
 * so the page applies them itself.
 */
export function parseAuthHash(hash: string): AuthHash | null {
  const params = new URLSearchParams(String(hash ?? "").replace(/^#/, ""));
  const errorCode = params.get("error_code") || params.get("error");
  if (errorCode) {
    return {
      kind: "error",
      code: errorCode,
      description: params.get("error_description") ?? "",
    };
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { kind: "session", accessToken, refreshToken, type: params.get("type") ?? "" };
}

export type AdminSignInStep =
  | { step: "password" }
  | { step: "set_password" }
  | { step: "enrol_totp" }
  | { step: "verify_totp" }
  | { step: "reauthenticate" }
  | { step: "denied"; reason: "not_admin" | "inactive" | "professional_account" }
  | { step: "error" }
  | { step: "done" };

export function adminSignInStep(input: {
  access: "ok" | AdminAccessDenial;
  /** Arrived from an invite or password-recovery link. */
  mustSetPassword?: boolean;
  hasVerifiedFactor?: boolean;
}): AdminSignInStep {
  const { access } = input;
  switch (access) {
    case "signed_out":
      return { step: "password" };
    case "not_admin":
    case "inactive":
    case "professional_account":
      return { step: "denied", reason: access };
    case "unavailable":
    case "read_only":
      return { step: "error" };
    default:
      break;
  }
  // With an authenticator app, Supabase only lets an aal2 session change the
  // password, so a recovering admin enters their code first.
  if (input.mustSetPassword && (access === "ok" || !input.hasVerifiedFactor)) {
    return { step: "set_password" };
  }
  if (access === "ok") return { step: "done" };
  if (access === "mfa_expired") return { step: "reauthenticate" };
  return input.hasVerifiedFactor ? { step: "verify_totp" } : { step: "enrol_totp" };
}
