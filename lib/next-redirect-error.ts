/**
 * Next.js `redirect()` throws; catch blocks must rethrow it or the navigation never happens
 * and client submitting UI stays stuck.
 */
export function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
