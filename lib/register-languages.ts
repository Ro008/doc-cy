import { CYPRUS_SPOKEN_LANGUAGE_LABELS } from "@/lib/cyprus-languages";

/** Shown first on /register: the languages most professionals in Cyprus consult in. */
export const REGISTER_PRIMARY_LANGUAGES = [
  "Greek",
  "English",
  "Russian",
  "Turkish",
  "Ukrainian",
  "Hebrew",
] as const;

const PRIMARY = new Set<string>(REGISTER_PRIMARY_LANGUAGES);

/**
 * Which language pills to show. Collapsed: the primary set plus anything already
 * picked from "More languages", so a choice never disappears from view.
 */
export function registerLanguageOptions(
  selected: readonly string[],
  expanded: boolean,
): { visible: string[]; hiddenCount: number } {
  const picked = new Set(selected);
  const rest = CYPRUS_SPOKEN_LANGUAGE_LABELS.filter((label) => !PRIMARY.has(label));
  const shownRest = expanded ? rest : rest.filter((label) => picked.has(label));
  return {
    visible: [...REGISTER_PRIMARY_LANGUAGES, ...shownRest],
    hiddenCount: rest.length - shownRest.length,
  };
}
