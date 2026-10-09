import { settingsActionErrorMessage } from "@/lib/settings-backend-pending";

/**
 * Account tab of settings (user, 2026-10-01): one "Sign-in & security" card, and
 * Promote as its own section. "Change password" reuses the forgot-password email
 * (POST /api/auth/forgot-password, unchanged), sent to the signed-in address.
 */

export function changePasswordMessage(
  status: number,
  body: { ok?: unknown; reason?: unknown } | null | undefined,
  email: string,
): { ok: boolean; message: string } {
  if (status >= 200 && status < 300 && body?.ok !== false) {
    return { ok: true, message: `Check ${email}: we sent a link to set a new password.` };
  }
  if (status === 429) {
    return { ok: false, message: "Too many tries. Please wait an hour and try again." };
  }
  return { ok: false, message: "Could not send the email. Please try again." };
}

/**
 * Changing the sign-in email (user, 2026-10-09). The UI sends POST /api/account/email
 * with `{ "email" }`; the change applies only once the doctor opens the confirmation
 * link sent to the new address. EXPECTED TO FAIL until Livio builds that endpoint
 * (and decides what else follows the new address: docs/handoff/settings-redesign.md).
 */
export function validateNewEmail(currentEmail: string, input: string): string | null {
  const next = input.trim();
  if (!next) return "Enter your new email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(next)) return "That doesn't look like an email address.";
  if (next.toLowerCase() === currentEmail.trim().toLowerCase()) return "That's already your email.";
  return null;
}

export function changeEmailMessage(
  status: number,
  body: { message?: unknown } | null | undefined,
  newEmail: string,
): { ok: boolean; message: string } {
  if (status >= 200 && status < 300) {
    return {
      ok: true,
      message: `Check ${newEmail}: open the link we sent to confirm it. Until then, keep signing in with your current email.`,
    };
  }
  if (status === 409) return { ok: false, message: "That email already has a DocCy account." };
  if (status === 429) return { ok: false, message: "Too many tries. Please wait an hour and try again." };
  return {
    ok: false,
    message: settingsActionErrorMessage("changeEmail", status, body, "Could not change your email. Please try again."),
  };
}

/** The booking link as a doctor reads it: no protocol, no www, no tracking params. */
export function shortBookingLink(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.host.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${host}${path}`;
  } catch {
    return url;
  }
}
