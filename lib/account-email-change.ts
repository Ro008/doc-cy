/**
 * Account → "Change email" (user, 2026-10-11). The address does two jobs: she signs in
 * with it and booking requests are sent to it, so a change moves both together. A link
 * goes to the new address; nothing changes until she opens it and confirms. One change
 * waits at a time (`professional_email_changes`); the old address is told afterwards.
 * No imports: the page, the routes and the tests share this.
 */

/** The confirmation link lasts an hour and works once. */
export const EMAIL_CHANGE_LINK_MINUTES = 60;

export const EMAIL_CHANGE_CONFIRM_PATH = "/account/confirm-email";

export function emailChangeConfirmUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}${EMAIL_CHANGE_CONFIRM_PATH}?token=${encodeURIComponent(token)}`;
}

/** What `professional_email_change_start` refused, as the Account card shows it. */
export function emailChangeStartStatus(
  error: { code?: string | null; message?: string | null } | null | undefined,
): { status: number; message?: string } {
  if (!error) return { status: 200 };
  if (error.code === "23505") return { status: 409, message: "That email already has a DocCy account." };
  if (error.code === "22023") {
    return {
      status: 400,
      message: String(error.message ?? "").includes("already her email")
        ? "That's already your email."
        : "That doesn't look like an email address.",
    };
  }
  return { status: 500, message: "Could not change your email. Please try again." };
}

export type PendingEmailChange = { email: string };

/** The change still waiting for its link, or null (none, or the link expired). */
export function pendingEmailChangeFromRow(
  row: { new_email?: string | null; expires_at?: string | null } | null | undefined,
  now: number = Date.now(),
): PendingEmailChange | null {
  const email = String(row?.new_email ?? "").trim();
  const expires = Date.parse(String(row?.expires_at ?? ""));
  if (!email || !Number.isFinite(expires) || expires <= now) return null;
  return { email };
}

/** What the confirm page says after its button is pressed. */
export function confirmEmailChangeOutcome(
  status: number,
  body: { email?: unknown } | null | undefined,
): { ok: boolean; title: string; message: string } {
  if (status >= 200 && status < 300) {
    const email = String(body?.email ?? "").trim() || "your new email";
    return {
      ok: true,
      title: "Your email is changed",
      message: `You now sign in to DocCy with ${email}, and booking requests are sent there.`,
    };
  }
  if (status === 410 || status === 400 || status === 404) {
    return {
      ok: false,
      title: "This link no longer works",
      message:
        "It was already used, cancelled, or it expired. Your email has not changed. To try again, sign in and go to Settings → Account.",
    };
  }
  if (status === 409) {
    return {
      ok: false,
      title: "That email is already in use",
      message: "Another DocCy account uses this address, so your email has not changed.",
    };
  }
  return {
    ok: false,
    title: "Something went wrong",
    message: "Your email has not changed. Please try the link again in a moment.",
  };
}
