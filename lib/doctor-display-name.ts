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

/** Split a listing/profile name into the register first + last fields. */
export function splitProfessionalFullName(fullName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const cleaned = doctorDashboardDisplayName(fullName);
  if (!cleaned || cleaned === "Professional") return { firstName: "", lastName: "" };
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export function joinProfessionalFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
