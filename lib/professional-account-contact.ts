/** Signup/account email — never the scraped directory email when both exist. */
export function professionalAccountEmail(row: {
  registration_email?: string | null;
  email?: string | null;
}): string {
  return (
    String(row.registration_email ?? "").trim() || String(row.email ?? "").trim()
  );
}
