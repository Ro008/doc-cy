/**
 * Language pill styles for public profile + dashboards (canonical themes in cyprus-languages).
 */

import { languageThemeForLabel } from "@/lib/cyprus-languages";

export type LanguageChip = {
  label: string;
  /** Full Tailwind classes for the pill */
  pillClass: string;
};

export function languageToChip(raw: string, _i: number): LanguageChip {
  const t = languageThemeForLabel(raw);
  return { label: t.label, pillClass: t.pillClass };
}
