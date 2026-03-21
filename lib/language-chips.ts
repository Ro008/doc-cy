/**
 * Language pill styles. Classes MUST live in scanned files: tailwind includes `./lib/**`.
 * Solid, high-contrast colors so each language reads instantly (no flag emoji).
 */

export type LanguageChip = {
  label: string;
  /** Full Tailwind classes for the pill */
  pillClass: string;
};

const NORMALIZE = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const PRESETS: { match: RegExp; label: string; pillClass: string }[] = [
  {
    match: /^(en(glish)?|ingl[eé]s)$/i,
    label: "English",
    pillClass:
      "bg-red-600 text-white shadow-lg shadow-red-600/50 ring-1 ring-white/30",
  },
  {
    match: /^(el(la)?|greek|ellinik|ελλην)/i,
    label: "Greek",
    pillClass:
      "bg-blue-600 text-white shadow-lg shadow-blue-600/50 ring-1 ring-white/30",
  },
  {
    match: /^cy(priot)?$/i,
    label: "Greek (Cyprus)",
    pillClass:
      "bg-sky-600 text-white shadow-lg shadow-sky-600/50 ring-1 ring-white/30",
  },
  {
    match: /^es(panol|pañol)?$/i,
    label: "Spanish",
    pillClass:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-600/50 ring-1 ring-white/30",
  },
  {
    match: /^fr(ench|ançais)?$/i,
    label: "French",
    pillClass:
      "bg-violet-600 text-white shadow-lg shadow-violet-600/50 ring-1 ring-white/30",
  },
  {
    match: /^de(utsch)?$/i,
    label: "German",
    pillClass:
      "bg-amber-600 text-white shadow-lg shadow-amber-600/50 ring-1 ring-white/30",
  },
  {
    match: /^it(alian|aliano)?$/i,
    label: "Italian",
    pillClass:
      "bg-green-600 text-white shadow-lg shadow-green-600/50 ring-1 ring-white/30",
  },
  {
    match: /^tr(urkish)?$/i,
    label: "Turkish",
    pillClass:
      "bg-rose-600 text-white shadow-lg shadow-rose-600/50 ring-1 ring-white/30",
  },
  {
    match: /^ru(ssian)?$/i,
    label: "Russian",
    pillClass:
      "bg-indigo-600 text-white shadow-lg shadow-indigo-600/50 ring-1 ring-white/30",
  },
  {
    match: /^ar(abic)?$/i,
    label: "Arabic",
    pillClass:
      "bg-lime-500 text-slate-900 shadow-lg shadow-lime-500/50 ring-1 ring-white/40",
  },
];

const FALLBACK_PILLS = [
  "bg-cyan-600 text-white shadow-lg shadow-cyan-600/50 ring-1 ring-white/30",
  "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/50 ring-1 ring-white/30",
  "bg-orange-600 text-white shadow-lg shadow-orange-600/50 ring-1 ring-white/30",
] as const;

export function languageToChip(raw: string, fallbackIndex: number): LanguageChip {
  const n = NORMALIZE(raw);
  if (!n) {
    const pretty = raw.trim() || "—";
    return {
      label: pretty,
      pillClass: FALLBACK_PILLS[fallbackIndex % FALLBACK_PILLS.length],
    };
  }
  for (const { match, label, pillClass } of PRESETS) {
    if (match.test(n)) {
      return { label, pillClass };
    }
  }
  const pretty =
    raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
  return {
    label: pretty || raw,
    pillClass: FALLBACK_PILLS[fallbackIndex % FALLBACK_PILLS.length],
  };
}
