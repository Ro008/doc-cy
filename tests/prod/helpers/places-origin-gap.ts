/**
 * Origin smoke hits *.vercel.app. The Maps JS key is usually restricted to mydoccy.com,
 * so Places predictions fail there even though /register itself is healthy.
 */

export function isVercelAppHost(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.toLowerCase().endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export type PlacesPredictionProbe = {
  mapsLoaded: boolean;
  status: string;
  count: number;
};

/**
 * True when missing Places suggestions are the known origin referrer split,
 * not a product outage. Quota errors and a working API with no dropdown still fail.
 */
export function isExpectedVercelPlacesReferrerGap(
  isVercelOrigin: boolean,
  probe: PlacesPredictionProbe,
  pacItemVisible: boolean,
): boolean {
  if (pacItemVisible) return false;
  if (!isVercelOrigin) return false;

  const status = probe.status.toUpperCase();
  if (status === "OVER_QUERY_LIMIT") return false;
  if (status === "OK" && probe.count > 0) return false;
  if (status === "REQUEST_DENIED") return true;
  if (!probe.mapsLoaded) return true;
  if (status === "ZERO_RESULTS" || (status === "OK" && probe.count === 0)) return true;
  return false;
}
