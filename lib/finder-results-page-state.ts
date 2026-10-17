import { parseFinderResultsPage } from "@/lib/finder-results-paging";

/** Session cookie: Show more depth without putting ?page= in the address bar. */
export const FINDER_RESULTS_PAGE_COOKIE = "doccy_finder_results_page";

export type FinderResultsPageCookiePayload = {
  page: number;
  scope: string;
};

export function finderResultsListScope(input: {
  pathname: string;
  name?: string;
  town?: string;
  lat?: string | null;
  lon?: string | null;
  acc?: string | null;
}): string {
  const qs = new URLSearchParams();
  const name = input.name?.trim();
  if (name) qs.set("name", name);
  const town = input.town?.trim();
  if (town) qs.set("town", town);
  if (input.lat) qs.set("lat", input.lat);
  if (input.lon) qs.set("lon", input.lon);
  if (input.acc) qs.set("acc", input.acc);
  const query = qs.toString();
  return query ? `${input.pathname}?${query}` : input.pathname;
}

export function serializeFinderResultsPageCookie(
  payload: FinderResultsPageCookiePayload,
): string {
  return encodeURIComponent(JSON.stringify(payload));
}

export function parseFinderResultsPageCookiePayload(
  raw: string | null | undefined,
): FinderResultsPageCookiePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<FinderResultsPageCookiePayload>;
    const page = Number(parsed.page);
    const scope = typeof parsed.scope === "string" ? parsed.scope : "";
    if (!Number.isFinite(page) || page < 1 || !scope) return null;
    return { page: Math.floor(page), scope };
  } catch {
    return null;
  }
}

export function parseFinderResultsPageCookie(
  raw: string | null | undefined,
  scope: string,
): number | null {
  const parsed = parseFinderResultsPageCookiePayload(raw);
  if (!parsed || parsed.scope !== scope) return null;
  return parsed.page;
}

export function resolveFinderResultsPage(input: {
  cookieRaw?: string | null;
  scope: string;
  urlPage?: string | string[];
  hasListFilter?: boolean;
}): number {
  const fromCookie = parseFinderResultsPageCookie(input.cookieRaw, input.scope);
  if (fromCookie != null) {
    return parseFinderResultsPage(String(fromCookie), { hasListFilter: input.hasListFilter });
  }
  return parseFinderResultsPage(input.urlPage, { hasListFilter: input.hasListFilter });
}

/** Drop leftover ?page= from a public search URL. Returns null when already clean. */
export function hrefWithoutPageQuery(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (!params.has("page")) return null;
  params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function finderResultsPageCookieWriteValue(page: number, scope: string): string {
  const payload = serializeFinderResultsPageCookie({ page, scope });
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? ";Secure" : "";
  return `${FINDER_RESULTS_PAGE_COOKIE}=${payload};Path=/;SameSite=Lax${secure}`;
}

export function finderResultsPageCookieClearValue(): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? ";Secure" : "";
  return `${FINDER_RESULTS_PAGE_COOKIE}=;Path=/;Max-Age=0;SameSite=Lax${secure}`;
}

export function writeFinderResultsPageCookie(page: number, scope: string): void {
  if (typeof document === "undefined") return;
  document.cookie = finderResultsPageCookieWriteValue(page, scope);
}

export function clearFinderResultsPageCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = finderResultsPageCookieClearValue();
}
