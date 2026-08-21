export type VisitsRangeKey = "7d" | "30d" | "90d";

export type ManualVotesRangeKey = "7d" | "30d" | "90d";

export type CallToBookRangeKey = "7d" | "30d" | "90d";

export type OutreachMonthKey = "current" | "previous";

export type ManualVotesSortCol = "votes" | "name" | "district" | "specialty" | "last";

export type SortDir = "asc" | "desc";

export type FounderDashboardQuery = {
  visitsRange: VisitsRangeKey;
  manualVotesRange: ManualVotesRangeKey;
  manualVotesCol: ManualVotesSortCol;
  manualVotesDir: SortDir;
  callToBookRange: CallToBookRangeKey;
  outreachMonth: OutreachMonthKey;
};

function first(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

export function parseVisitsRange(value: string | string[] | undefined): VisitsRangeKey {
  const raw = first(value);
  if (raw === "30d" || raw === "90d") return raw;
  return "7d";
}

export function getVisitsWindowDays(range: VisitsRangeKey): number {
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7;
}

export function getVisitsRangeLabel(range: VisitsRangeKey): string {
  if (range === "30d") return "Last 30 days";
  if (range === "90d") return "Last 90 days";
  return "Last 7 days";
}

export function parseManualVotesRange(value: string | string[] | undefined): ManualVotesRangeKey {
  const raw = first(value);
  if (raw === "7d" || raw === "30d") return raw;
  return "90d";
}

export function parseManualVotesCol(value: string | string[] | undefined): ManualVotesSortCol {
  const raw = first(value);
  if (raw === "name" || raw === "district" || raw === "specialty" || raw === "last") return raw;
  return "votes";
}

export function parseManualVotesDir(value: string | string[] | undefined): SortDir {
  return first(value) === "asc" ? "asc" : "desc";
}

export function parseCallToBookRange(value: string | string[] | undefined): CallToBookRangeKey {
  const raw = first(value);
  if (raw === "30d" || raw === "90d") return raw;
  return "7d";
}

export function parseOutreachMonth(value: string | string[] | undefined): OutreachMonthKey {
  return first(value) === "previous" ? "previous" : "current";
}

export function getCallToBookWindowDays(range: CallToBookRangeKey): number {
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7;
}

export function getCallToBookRangeLabel(range: CallToBookRangeKey): string {
  if (range === "30d") return "Last 30 days";
  if (range === "90d") return "Last 90 days";
  return "Last 7 days";
}

export function parseFounderDashboardQuery(searchParams?: {
  visitsRange?: string | string[];
  manualVotesRange?: string | string[];
  manualVotesCol?: string | string[];
  manualVotesDir?: string | string[];
  callToBookRange?: string | string[];
  outreachMonth?: string | string[];
}): FounderDashboardQuery {
  return {
    visitsRange: parseVisitsRange(searchParams?.visitsRange),
    manualVotesRange: parseManualVotesRange(searchParams?.manualVotesRange),
    manualVotesCol: parseManualVotesCol(searchParams?.manualVotesCol),
    manualVotesDir: parseManualVotesDir(searchParams?.manualVotesDir),
    callToBookRange: parseCallToBookRange(searchParams?.callToBookRange),
    outreachMonth: parseOutreachMonth(searchParams?.outreachMonth),
  };
}

export function getManualVotesWindowDays(range: ManualVotesRangeKey): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

export function getManualVotesRangeLabel(range: ManualVotesRangeKey): string {
  if (range === "7d") return "Last 7 days";
  if (range === "30d") return "Last 30 days";
  return "Last 90 days";
}

export function founderDirectoryHref(
  q: FounderDashboardQuery,
  patch: Partial<FounderDashboardQuery> = {},
): string {
  const merged: FounderDashboardQuery = { ...q, ...patch };
  const sp = new URLSearchParams();
  sp.set("visitsRange", merged.visitsRange);
  sp.set("manualVotesRange", merged.manualVotesRange);
  sp.set("manualVotesCol", merged.manualVotesCol);
  sp.set("manualVotesDir", merged.manualVotesDir);
  sp.set("callToBookRange", merged.callToBookRange);
  sp.set("outreachMonth", merged.outreachMonth);
  return `/internal/directory?${sp.toString()}`;
}

/** First sort on a column uses this direction; same column again toggles in the table header. */
export function defaultSortDirForColumn(col: ManualVotesSortCol): SortDir {
  if (col === "name" || col === "district" || col === "specialty") return "asc";
  return "desc";
}

export function nextManualVotesSort(
  current: FounderDashboardQuery,
  col: ManualVotesSortCol,
): Pick<FounderDashboardQuery, "manualVotesCol" | "manualVotesDir"> {
  if (current.manualVotesCol !== col) {
    return { manualVotesCol: col, manualVotesDir: defaultSortDirForColumn(col) };
  }
  return {
    manualVotesCol: col,
    manualVotesDir: current.manualVotesDir === "asc" ? "desc" : "asc",
  };
}
