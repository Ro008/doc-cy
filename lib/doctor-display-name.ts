/**
 * Formal name for pro dashboard headers, e.g. "Dr. Andreas Nikos".
 */
export function doctorDashboardDisplayName(fullName: string | null | undefined): string {
  const t = (fullName ?? "").trim();
  if (!t) return "Professional";
  const lower = t.toLowerCase();
  if (lower.startsWith("dr.") || lower.startsWith("dr ")) return t;
  if (lower.startsWith("dra.") || lower.startsWith("dra ")) return t;
  if (lower.startsWith("doctor ")) return t.replace(/^doctor\s+/i, "Dr. ");
  return `Dr. ${t}`;
}
