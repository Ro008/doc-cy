/**
 * Display name for pro dashboard headers.
 *
 * We intentionally avoid honorifics like "Dr." so the UI stays inclusive for all
 * healthcare professionals (e.g. physiotherapists, psychologists, nutritionists).
 */
export function doctorDashboardDisplayName(fullName: string | null | undefined): string {
  const t = (fullName ?? "").trim();
  if (!t) return "Professional";

  // Strip common title prefixes if the user stored them in the profile name field.
  const withoutPrefix = t
    .replace(/^dr\.?\s+/i, "")
    .replace(/^dra\.?\s+/i, "")
    .replace(/^doctor\s+/i, "")
    .trim();

  return withoutPrefix || "Professional";
}

/** First token of a professional name, for greetings. Null when the name is missing. */
export function firstNameFromProfessionalName(fullName: string | null | undefined): string | null {
  const cleaned = doctorDashboardDisplayName(fullName);
  if (!cleaned || cleaned === "Professional") return null;
  const first = cleaned.split(/\s+/).find(Boolean) ?? "";
  return first || null;
}
