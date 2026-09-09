/** Practitioner password reset (DocCy Resend email + one-time recovery link). */

export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const AUTH_CALLBACK_PATH = "/auth/callback";

export { PASSWORD_MIN_LENGTH as PASSWORD_RESET_MIN_LENGTH } from "@/lib/password-policy";

function pathOnly(pathname: string): string {
  const path = pathname.split("?")[0]?.split("#")[0] || pathname;
  return path.replace(/\/$/, "") || "/";
}

/** Login / forgot / reset screens should not show agenda chrome. */
export function isAuthAccountUiPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === FORGOT_PASSWORD_PATH ||
    path.startsWith(`${FORGOT_PASSWORD_PATH}/`) ||
    path === RESET_PASSWORD_PATH ||
    path.startsWith(`${RESET_PASSWORD_PATH}/`)
  );
}

export function isForgotPasswordPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  return path === FORGOT_PASSWORD_PATH || path.startsWith(`${FORGOT_PASSWORD_PATH}/`);
}

export function isResetPasswordPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  return path === RESET_PASSWORD_PATH || path.startsWith(`${RESET_PASSWORD_PATH}/`);
}

export function isAuthCallbackPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  return path === AUTH_CALLBACK_PATH || path.startsWith(`${AUTH_CALLBACK_PATH}/`);
}

/** Recovery landing URL — must be allowlisted in Supabase Auth redirect URLs. */
export function passwordResetCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${AUTH_CALLBACK_PATH}`;
}

/** One-time link we put in the DocCy (Resend) email — verified in `/auth/callback`. */
export function passwordResetVerifyUrl(origin: string, tokenHash: string): string {
  const params = new URLSearchParams();
  params.set("token_hash", tokenHash);
  params.set("type", "recovery");
  return `${passwordResetCallbackUrl(origin)}?${params.toString()}`;
}

function isLocalDevOrigin(url: URL): boolean {
  if (url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return false;
  return url.port === "3000" || url.port === "3100";
}

/** Origins allowed as the recovery-link host (blocks open redirects). */
export function isAllowedPasswordResetOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.pathname !== "/" && url.pathname !== "") return false;
  if (url.search || url.hash) return false;
  if (isLocalDevOrigin(url)) return true;
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "mydoccy.com" || host === "www.mydoccy.com") return true;
  if (host.endsWith(".vercel.app")) return true;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      if (new URL(site).origin === url.origin) return true;
    } catch {
      // ignore invalid SITE_URL
    }
  }
  return false;
}

/** Prefer the browser Origin header; fall back to this request's host. */
export function resolvePasswordResetOrigin(req: Request): string | null {
  const header = req.headers.get("origin")?.trim().replace(/\/$/, "") || "";
  if (header && isAllowedPasswordResetOrigin(header)) return header;
  try {
    const fromRequest = new URL(req.url).origin;
    if (isAllowedPasswordResetOrigin(fromRequest)) return fromRequest;
  } catch {
    // ignore
  }
  return null;
}

export function forgotPasswordPathWithEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return FORGOT_PASSWORD_PATH;
  const params = new URLSearchParams();
  params.set("email", trimmed);
  return `${FORGOT_PASSWORD_PATH}?${params.toString()}`;
}

type GenerateLinkProperties = {
  hashed_token?: string;
  hashedToken?: string;
  action_link?: string;
  actionLink?: string;
};

/** Prefer our `/auth/callback?token_hash=` URL; fall back to GoTrue's action_link. */
export function passwordResetLinkFromGenerateLink(
  origin: string,
  properties: GenerateLinkProperties | null | undefined,
): string | null {
  const tokenHash = String(properties?.hashed_token || properties?.hashedToken || "").trim();
  if (tokenHash) return passwordResetVerifyUrl(origin, tokenHash);
  const actionLink = String(properties?.action_link || properties?.actionLink || "").trim();
  return actionLink || null;
}
