/**
 * How a reviewer's name appears publicly: first name + last initial ("Maria K.").
 * The full name stays stored; showing it would reveal who sees which professional,
 * which is health information (user, 2026-10-04).
 */
export function reviewDisplayName(fullName: string | null | undefined): string {
  const words = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A patient";
  const capitalise = (w: string) => w.charAt(0).toLocaleUpperCase() + w.slice(1);
  const first = capitalise(words[0]!);
  if (words.length === 1) return first;
  const initial = words[words.length - 1]!.charAt(0).toLocaleUpperCase();
  return `${first} ${initial}.`;
}
