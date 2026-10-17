/**
 * G's day circles on a finder card (Finder G, step 4; user, 2026-10-16): a week of seven
 * days, today first; a day with free times at the card's clinic is filled. The chosen day
 * and the arrows are shared, so every card shows the same day; under the circles the card
 * shows that day's times, or the next day it has some.
 */

export const FINDER_DAY_STRIP_DAY_COUNT = 7;

type DayHeaderLike = { dateKey: string; weekdayLabel: string; isToday: boolean };
type SlotLike = { slotKey: string; timeLabel: string };
type CalendarDayLike = { dateKey: string; slots: readonly SlotLike[] };

export type FinderDayStripCircle = {
  /** Index in the page's day list (0 = today). */
  index: number;
  dateKey: string;
  /** "TODAY", then "SAT", "SUN", ... */
  label: string;
  dayNumber: number;
  hasTimes: boolean;
};

export type FinderDayStripState<S extends SlotLike = SlotLike> =
  | { kind: "times"; slots: readonly S[] }
  | { kind: "none-this-day"; nextFreeIndex: number }
  | { kind: "none-ahead" };

const LONG_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** `dateKey` is a Cyprus calendar day (yyyy-MM-dd); read it as a plain date, no time zone. */
function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** "Saturday, 17 October", above the chosen day's times: the profile's "EEEE, d MMMM" (user, 2026-10-16). */
export function finderDayStripLongDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return `${LONG_WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${LONG_MONTHS[date.getUTCMonth()]}`;
}

/** "Mon 19 Oct", on "Next free". */
export function finderDayStripShortDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return `${LONG_WEEKDAYS[date.getUTCDay()]!.slice(0, 3)} ${date.getUTCDate()} ${LONG_MONTHS[date.getUTCMonth()]!.slice(0, 3)}`;
}

/** The first day of the week that holds `dayIndex` (weeks start today, every 7 days). */
export function finderDayStripWeekStart(dayIndex: number): number {
  return Math.floor(Math.max(0, dayIndex) / FINDER_DAY_STRIP_DAY_COUNT) * FINDER_DAY_STRIP_DAY_COUNT;
}

function slotsByDateKey<S extends SlotLike>(days: readonly { dateKey: string; slots: readonly S[] }[]) {
  return new Map(days.map((day) => [day.dateKey, day.slots] as const));
}

/** The seven circles from `weekStart`, for one card's calendar. */
export function finderDayStripCircles(
  headers: readonly DayHeaderLike[],
  calendarDays: readonly CalendarDayLike[],
  weekStart: number,
): FinderDayStripCircle[] {
  const slots = slotsByDateKey(calendarDays);
  return headers.slice(weekStart, weekStart + FINDER_DAY_STRIP_DAY_COUNT).map((header, k) => ({
    index: weekStart + k,
    dateKey: header.dateKey,
    label: header.isToday ? "TODAY" : header.weekdayLabel,
    dayNumber: parseDateKey(header.dateKey).getUTCDate(),
    hasTimes: (slots.get(header.dateKey)?.length ?? 0) > 0,
  }));
}

/**
 * What the card shows for the chosen day. `calendarDays` start today, like the page's
 * day list, so a day's index is the same in both.
 */
export function finderDayStripState<S extends SlotLike>(
  calendarDays: readonly { dateKey: string; slots: readonly S[] }[],
  selectedIndex: number,
): FinderDayStripState<S> {
  const day = calendarDays[selectedIndex];
  if (day && day.slots.length > 0) return { kind: "times", slots: day.slots };
  const next = calendarDays.findIndex((d, i) => i > selectedIndex && d.slots.length > 0);
  return next === -1 ? { kind: "none-ahead" } : { kind: "none-this-day", nextFreeIndex: next };
}

/** Two rows of times on the left of the card: four a row on a phone, five from `sm`. */
const TIME_GRID_CELLS = { phone: 12, wide: 18 } as const;

export type FinderDayStripTimeGrid = {
  /** Times to render; the ones past a screen's limit are hidden on that screen. */
  rendered: number;
  phone: { times: number; allTimes: boolean };
  wide: { times: number; allTimes: boolean };
};

/**
 * How the chosen day's times fill the card's three rows (mockup L, 2026-10-16): every time while they
 * fit; when they no longer do, the last cell becomes All times (it opens the profile pop-up).
 */
export function finderDayStripTimeGrid(count: number): FinderDayStripTimeGrid {
  const fit = (cells: number) =>
    count <= cells ? { times: count, allTimes: false } : { times: cells - 1, allTimes: true };
  const phone = fit(TIME_GRID_CELLS.phone);
  const wide = fit(TIME_GRID_CELLS.wide);
  return { rendered: Math.max(phone.times, wide.times), phone, wide };
}
