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
