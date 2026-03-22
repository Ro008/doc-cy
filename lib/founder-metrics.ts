import { canonicalLanguageLabel } from "@/lib/cyprus-languages";

export type SpecialtyCount = { label: string; count: number };
export type LanguageCount = { label: string; count: number };

export function aggregateSpecialties(
  doctors: { specialty: string | null | undefined }[]
): SpecialtyCount[] {
  const map = new Map<string, number>();
  for (const d of doctors) {
    const s = d.specialty?.trim() || "Unspecified";
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/** Counts how many doctors list each language (one doctor can add to several). */
export function aggregateLanguages(
  doctors: { languages: string[] | null | undefined }[]
): LanguageCount[] {
  const map = new Map<string, number>();
  for (const d of doctors) {
    for (const lang of d.languages ?? []) {
      const t = String(lang).trim();
      if (!t) continue;
      const key = canonicalLanguageLabel(t);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function maxCount(items: { count: number }[]): number {
  if (items.length === 0) return 1;
  return Math.max(1, ...items.map((i) => i.count));
}
