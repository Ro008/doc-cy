export type VisitsRangeKey = "7d" | "30d" | "90d";

export type ManualVotesRangeKey = "7d" | "30d" | "90d" | "all";

export type CallToBookRangeKey = "7d" | "30d" | "90d";

export type ManualVotesSortCol = "votes" | "name" | "district" | "specialty" | "last";

export type CallToBookSortCol =
  | "clicks"
  | "finder"
  | "profile"
  | "name"
  | "district"
  | "specialty"
  | "last";

export type SortDir = "asc" | "desc";

export type FounderDashboardQuery = {
  visitsRange: VisitsRangeKey;
  manualVotesRange: ManualVotesRangeKey;
  manualVotesCol: ManualVotesSortCol;
  manualVotesDir: SortDir;
  callToBookRange: CallToBookRangeKey;
  callToBookCol: CallToBookSortCol;
  callToBookDir: SortDir;
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
  if (raw === "7d" || raw === "30d" || raw === "90d") return raw;
  return "all";
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

export function parseCallToBookCol(value: string | string[] | undefined): CallToBookSortCol {
  const raw = first(value);
  if (
    raw === "name" ||
    raw === "district" ||
    raw === "specialty" ||
    raw === "last" ||
    raw === "finder" ||
    raw === "profile"
  ) {
    return raw;
  }
  return "clicks";
}

export function parseCallToBookDir(value: string | string[] | undefined): SortDir {
  return first(value) === "asc" ? "asc" : "desc";
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
  callToBookCol?: string | string[];
  callToBookDir?: string | string[];
}): FounderDashboardQuery {
  return {
    visitsRange: parseVisitsRange(searchParams?.visitsRange),
    manualVotesRange: parseManualVotesRange(searchParams?.manualVotesRange),
    manualVotesCol: parseManualVotesCol(searchParams?.manualVotesCol),
    manualVotesDir: parseManualVotesDir(searchParams?.manualVotesDir),
    callToBookRange: parseCallToBookRange(searchParams?.callToBookRange),
    callToBookCol: parseCallToBookCol(searchParams?.callToBookCol),
    callToBookDir: parseCallToBookDir(searchParams?.callToBookDir),
  };
}

/** `null` = all time (no created_at lower bound). */
export function getManualVotesWindowDays(range: ManualVotesRangeKey): number | null {
  if (range === "all") return null;
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

export function getManualVotesRangeLabel(range: ManualVotesRangeKey): string {
  if (range === "7d") return "Last 7 days";
  if (range === "30d") return "Last 30 days";
  if (range === "90d") return "Last 90 days";
  return "All time";
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
  sp.set("callToBookCol", merged.callToBookCol);
  sp.set("callToBookDir", merged.callToBookDir);
  return `/internal/directory?${sp.toString()}`;
}

export type DirectoryClicksCsvActionFilter =
  | "show_phone_number"
  | "request_online_appointment";

export function parseDirectoryClicksCsvAction(
  value: string | null | undefined,
): DirectoryClicksCsvActionFilter | null {
  if (value === "show_phone_number" || value === "request_online_appointment") return value;
  return null;
}

export function founderDirectoryClicksCsvHref(
  q: FounderDashboardQuery,
  action: DirectoryClicksCsvActionFilter,
): string {
  const sp = new URLSearchParams();
  sp.set("action", action);
  if (action === "show_phone_number") sp.set("callToBookRange", q.callToBookRange);
  else sp.set("manualVotesRange", q.manualVotesRange);
  return `/api/internal/directory-clicks.csv?${sp.toString()}`;
}

/** First sort on a column uses this direction; same column again toggles in the table header. */
export function defaultSortDirForColumn(col: ManualVotesSortCol | CallToBookSortCol): SortDir {
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

export function nextCallToBookSort(
  current: FounderDashboardQuery,
  col: CallToBookSortCol,
): Pick<FounderDashboardQuery, "callToBookCol" | "callToBookDir"> {
  if (current.callToBookCol !== col) {
    return { callToBookCol: col, callToBookDir: defaultSortDirForColumn(col) };
  }
  return {
    callToBookCol: col,
    callToBookDir: current.callToBookDir === "asc" ? "desc" : "asc",
  };
}
