/**
 * Curated spoken languages for Cyprus directory + booking (canonical labels + Tailwind themes).
 * Classes must appear as string literals so Tailwind JIT includes them (keep in scanned files).
 */

export type CyprusLanguageTheme = {
  /** Canonical label stored in DB and shown in UI */
  label: string;
  /** Badge / pill on dark backgrounds */
  pillClass: string;
  /** Solid bar fill (language distribution chart) */
  barClass: string;
};

const OTHER_THEME: CyprusLanguageTheme = {
  label: "Other",
  pillClass:
    "bg-slate-600 text-slate-100 ring-1 ring-white/15 shadow-md shadow-black/30",
  barClass: "bg-slate-500",
};

/** Display order in dropdowns */
export const CYPRUS_SPOKEN_LANGUAGE_THEMES: readonly CyprusLanguageTheme[] = [
  {
    label: "Greek",
    pillClass:
      "bg-blue-800 text-white ring-1 ring-white/25 shadow-md shadow-blue-950/50",
    barClass: "bg-blue-600",
  },
  {
    label: "English",
    pillClass:
      "bg-indigo-600 text-white ring-1 ring-white/25 shadow-md shadow-indigo-950/40",
    barClass: "bg-indigo-500",
  },
  {
    label: "Turkish",
    pillClass:
      "bg-red-600 text-white ring-1 ring-red-900/30 shadow-md shadow-red-950/40",
    barClass: "bg-red-500",
  },
  {
    label: "Russian",
    pillClass:
      "bg-sky-600 text-white ring-1 ring-white/25 shadow-md shadow-sky-950/40",
    barClass: "bg-sky-500",
  },
  {
    label: "Spanish",
    pillClass:
      "bg-amber-500 text-slate-900 ring-1 ring-amber-200/40 shadow-md shadow-amber-900/30",
    barClass: "bg-amber-500",
  },
  {
    label: "French",
    pillClass:
      "bg-blue-500 text-white ring-1 ring-white/30 shadow-md shadow-blue-900/35",
    barClass: "bg-blue-500",
  },
  {
    label: "German",
    pillClass:
      "bg-stone-600 text-stone-50 ring-1 ring-stone-400/25 shadow-md shadow-stone-950/40",
    barClass: "bg-stone-500",
  },
  {
    label: "Italian",
    pillClass:
      "bg-emerald-600 text-white ring-1 ring-white/25 shadow-md shadow-emerald-950/40",
    barClass: "bg-emerald-500",
  },
  {
    label: "Arabic",
    pillClass:
      "bg-teal-600 text-white ring-1 ring-white/25 shadow-md shadow-teal-950/40",
    barClass: "bg-teal-500",
  },
  {
    label: "Romanian",
    pillClass:
      "bg-yellow-400 text-slate-900 ring-1 ring-yellow-200/50 shadow-md shadow-yellow-900/20",
    barClass: "bg-yellow-400",
  },
  {
    label: "Bulgarian",
    pillClass:
      "bg-yellow-400 text-slate-900 ring-1 ring-yellow-200/50 shadow-md shadow-yellow-900/20",
    barClass: "bg-yellow-400",
  },
  OTHER_THEME,
] as const;

export const CYPRUS_SPOKEN_LANGUAGE_LABELS = CYPRUS_SPOKEN_LANGUAGE_THEMES.map(
  (t) => t.label
) as readonly string[];

const LABEL_TO_THEME = new Map(
  CYPRUS_SPOKEN_LANGUAGE_THEMES.map((t) => [t.label, t])
);

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Normalized typo / locale key → canonical label */
const ALIAS_TO_LABEL: Record<string, string> = {
  greek: "Greek",
  greece: "Greek",
  ellinika: "Greek",
  english: "English",
  eng: "English",
  en: "English",
  turkish: "Turkish",
  turkce: "Turkish",
  russian: "Russian",
  spanish: "Spanish",
  espanol: "Spanish",
  esp: "Spanish",
  french: "French",
  /** Common typo */
  frenchh: "French",
  francais: "French",
  deutsch: "German",
  german: "German",
  italian: "Italian",
  italiano: "Italian",
  arabic: "Arabic",
  romanian: "Romanian",
  romana: "Romanian",
  bulgarian: "Bulgarian",
  other: "Other",
};

function titleCaseWords(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Map free-text or legacy DB values to a display/canonical label when possible.
 * Unknown strings are title-cased and styled as "Other" in the UI.
 */
export function canonicalLanguageLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (LABEL_TO_THEME.has(trimmed)) return trimmed;

  const alias = ALIAS_TO_LABEL[normalizeKey(trimmed)];
  if (alias) return alias;

  for (const t of CYPRUS_SPOKEN_LANGUAGE_THEMES) {
    if (normalizeKey(t.label) === normalizeKey(trimmed)) return t.label;
  }

  return titleCaseWords(trimmed);
}

export function isMasterLanguageLabel(s: string): boolean {
  return LABEL_TO_THEME.has(s.trim());
}

/**
 * Validate payload from forms / API: only canonical master labels, deduped, master-list order.
 */
export function validateLanguageSelection(
  labels: unknown
):
  | { ok: true; value: string[] }
  | { ok: false; message: string } {
  const list: string[] = [];
  if (Array.isArray(labels)) {
    for (const x of labels) list.push(String(x).trim());
  } else if (typeof labels === "string") {
    for (const part of labels.split(/[,;]/)) list.push(part.trim());
  } else {
    return { ok: false, message: "Languages are required." };
  }

  const dedup = new Set<string>();
  for (const c of list) {
    if (!c) continue;
    if (!isMasterLanguageLabel(c)) {
      return {
        ok: false,
        message: `Invalid language “${c}”. Choose only from the predefined list.`,
      };
    }
    dedup.add(c);
  }

  const out = Array.from(dedup);
  if (out.length === 0) {
    return { ok: false, message: "Select at least one language." };
  }

  const order = new Map(
    CYPRUS_SPOKEN_LANGUAGE_LABELS.map((l, i) => [l, i])
  );
  out.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
  return { ok: true, value: out };
}

/** Theme for badges and charts; unknown labels use Other styling with readable text. */
export function languageThemeForLabel(raw: string): CyprusLanguageTheme {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ...OTHER_THEME, label: "—" };
  }
  const canon = canonicalLanguageLabel(trimmed);
  const fromMaster = LABEL_TO_THEME.get(canon);
  if (fromMaster) return fromMaster;
  return {
    label: canon,
    pillClass: OTHER_THEME.pillClass,
    barClass: OTHER_THEME.barClass,
  };
}
