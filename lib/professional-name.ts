/** First word of the professional's name for greetings (no titles). */
export function professionalFirstName(fullName: string | null | undefined): string {
  const cleaned = String(fullName ?? "")
    .replace(/^(dr\.?|δρ\.?|doctor|doc)\s+/i, "")
    .trim();
  const first = cleaned.split(/\s+/).filter(Boolean)[0];
  return first ?? "there";
}
