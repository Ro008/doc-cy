/** Safe internal post-login path (blocks open redirects). */
export function safeAuthNextPath(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  if (value.includes("\\")) return null;
  return value;
}
