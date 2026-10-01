/**
 * TEMPORARY (user, 2026-10-01): settings calls endpoints the backend builds after
 * this frontend (docs/handoff/settings-redesign.md). Until they exist they answer
 * 404, and the page says so plainly. Remove once Livio's backend is in.
 */
export const BACKEND_PENDING_MESSAGE =
  "This fails as expected for now: it works once Livio updates the backend.";

export function settingsActionErrorMessage(
  status: number,
  body: { message?: unknown } | null | undefined,
  fallback: string,
): string {
  if (status === 404 || status === 405) return BACKEND_PENDING_MESSAGE;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  return message || fallback;
}
