/**
 * The language chip: one calm colour for every language (user, 2026-10-13), not a colour per
 * language. The colours said nothing (nobody learns that rose is Chinese) and red or amber
 * read as a warning. One chip per surface it sits on. The founders' internal pages keep the
 * per-language colours of lib/cyprus-languages.ts.
 */

/** On white or light cards: the finder cards, the registration form. */
export const LANGUAGE_CHIP_ON_LIGHT = "bg-clinical-50 text-clinical-900 ring-1 ring-inset ring-clinical-200";

/** On the professional's dark pages: Settings. */
export const LANGUAGE_CHIP_ON_DARK = "bg-clinical-500/15 text-clinical-50 ring-1 ring-inset ring-clinical-400/35";

/** On the public profile's teal hero: its own text colour on a white tint, lighter than the
 * specialty pills. (The accent colours are CSS variables: Tailwind's /opacity does not work on them.) */
export const LANGUAGE_CHIP_ON_ACCENT = "bg-white/30 text-accent-on";
