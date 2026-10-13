/**
 * The Visits tab's date-range picker (user, 2026-10-12): a branded calendar with shortcuts
 * instead of the browser's two date inputs. Days are Cyprus calendar days, YYYY-MM-DD; the
 * calendar itself works on local dates at noon, so a day never slips across midnight.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function dateToDayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function shift(key: string, days: number): string {
  const d = dayKeyToDate(key);
  d.setDate(d.getDate() + days);
  return dateToDayKey(d);
}

export type RangePresetId = "last7" | "last30" | "thisMonth" | "lastMonth" | "thisYear";

export type RangePreset = { id: RangePresetId; label: string; from: string; to: string };

/** Shortcuts relative to `todayKey` (today in Cyprus). */
export function rangePresets(todayKey: string): RangePreset[] {
  const today = dayKeyToDate(todayKey);
  const y = today.getFullYear();
  const m = today.getMonth();
  const monthStart = dateToDayKey(new Date(y, m, 1, 12));
  return [
    { id: "last7", label: "Last 7 days", from: shift(todayKey, -6), to: todayKey },
    { id: "last30", label: "Last 30 days", from: shift(todayKey, -29), to: todayKey },
    { id: "thisMonth", label: "This month", from: monthStart, to: todayKey },
    {
      id: "lastMonth",
      label: "Last month",
      from: dateToDayKey(new Date(y, m - 1, 1, 12)),
      to: dateToDayKey(new Date(y, m, 0, 12)),
    },
    { id: "thisYear", label: "This year", from: dateToDayKey(new Date(y, 0, 1, 12)), to: todayKey },
  ];
}

export function activeRangePreset(
  from: string | null,
  to: string | null,
  todayKey: string,
): RangePresetId | null {
  if (!from || !to) return null;
  return rangePresets(todayKey).find((p) => p.from === from && p.to === to)?.id ?? null;
}

function part(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return { y, text: `${d} ${MONTHS[m - 1]}` };
}

/** "1 Oct – 12 Oct 2026", "From 1 Oct 2026", "Any date". */
export function rangeLabel(from: string | null, to: string | null): string {
  if (!from && !to) return "Any date";
  if (from && !to) return `From ${part(from).text} ${part(from).y}`;
  if (!from && to) return `Until ${part(to).text} ${part(to).y}`;
  const a = part(from as string);
  const b = part(to as string);
  if (from === to) return `${a.text} ${a.y}`;
  return a.y === b.y ? `${a.text} – ${b.text} ${b.y}` : `${a.text} ${a.y} – ${b.text} ${b.y}`;
}
