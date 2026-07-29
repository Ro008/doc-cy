import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { AUTOMATED_EMAIL_FOOTER_TEXT, escapeHtml } from "@/lib/resend";
import { getPublicBookingBaseUrl } from "@/lib/site-url";

export const FINDER_TRAFFIC_ALERT_KEY = "finder_traffic_spike";

/** Alert when current hour is ≥ multiplier × 7-day same-slot average. */
export const FINDER_TRAFFIC_SPIKE_MULTIPLIER = 3;

/** Ignore tiny baselines (views/hour) so normal noise does not trigger alerts. */
export const FINDER_TRAFFIC_MIN_BASELINE = 10;

/** Minimum human finder views in the hour before we alert (even if baseline is low). */
export const FINDER_TRAFFIC_MIN_ABSOLUTE = 100;

/** Do not send the same alert type more often than this (ms). */
export const FINDER_TRAFFIC_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export type FinderTrafficWindowCounts = {
  humanCount: number;
  botCount: number;
};

export type FinderTrafficAggregateRow = {
  page_path: string;
  country: string | null;
  user_agent: string | null;
  is_bot: boolean;
};

export type FinderTrafficAlertMetrics = {
  windowStart: Date;
  windowEnd: Date;
  humanCount: number;
  botCount: number;
  baselineHumanAvg: number;
  baselineSampleDays: number;
  multiplier: number;
  topPages: { path: string; count: number }[];
  topCountries: { country: string; count: number }[];
  sampleUserAgents: string[];
};

export function isFinderTrafficPath(pagePath: string): boolean {
  const path = pagePath.trim();
  return path === "/finder" || path.startsWith("/finder/");
}

export function computeBaselineAverage(counts: number[]): number {
  if (counts.length === 0) return 0;
  const sum = counts.reduce((acc, n) => acc + n, 0);
  return sum / counts.length;
}

export function shouldSendFinderTrafficAlert(input: {
  humanCount: number;
  baselineHumanAvg: number;
  multiplier?: number;
  minBaseline?: number;
  minAbsolute?: number;
}): boolean {
  const multiplier = input.multiplier ?? FINDER_TRAFFIC_SPIKE_MULTIPLIER;
  const minBaseline = input.minBaseline ?? FINDER_TRAFFIC_MIN_BASELINE;
  const minAbsolute = input.minAbsolute ?? FINDER_TRAFFIC_MIN_ABSOLUTE;

  if (input.humanCount < minAbsolute) return false;

  if (input.baselineHumanAvg < minBaseline) {
    return input.humanCount >= minAbsolute * 2;
  }

  return input.humanCount >= input.baselineHumanAvg * multiplier;
}

function formatCyprusRange(start: Date, end: Date): string {
  const startLabel = formatInTimeZone(start, CY_TZ, "d MMM yyyy, HH:mm");
  const endLabel = formatInTimeZone(end, CY_TZ, "HH:mm");
  return `${startLabel} – ${endLabel} (Cyprus)`;
}

function formatMultiplier(current: number, baseline: number): string {
  if (baseline <= 0) return "n/a (no baseline yet)";
  return `${(current / baseline).toFixed(1)}×`;
}

export function buildFinderTrafficAlertEmail(metrics: FinderTrafficAlertMetrics): {
  subject: string;
  text: string;
  html: string;
} {
  const siteBase = getPublicBookingBaseUrl();
  const internalUrl = `${siteBase}/internal/directory`;
  const timeRange = formatCyprusRange(metrics.windowStart, metrics.windowEnd);
  const multiplierLabel = formatMultiplier(metrics.humanCount, metrics.baselineHumanAvg);
  const roundedBaseline = Math.round(metrics.baselineHumanAvg);

  const topPagesBlock =
    metrics.topPages.length > 0
      ? metrics.topPages
          .slice(0, 3)
          .map((row) => `• ${row.path} (${row.count})`)
          .join("\n")
      : "• —";

  const topCountriesBlock =
    metrics.topCountries.length > 0
      ? metrics.topCountries
          .slice(0, 3)
          .map((row) => `• ${row.country} (${row.count})`)
          .join("\n")
      : "• —";

  const subject = `[DocCy] Unusual Finder traffic — ${metrics.humanCount} views in the last hour`;

  const text = [
    "Hi,",
    "",
    "More people than usual visited the public Finder in the last hour.",
    "",
    "Summary",
    `• Last hour: ${metrics.humanCount} page views`,
    `• Your usual level for this time of day: about ${roundedBaseline}/hour`,
    `• That is ${multiplierLabel} your normal traffic`,
    metrics.botCount > 0 ? `• Automated crawlers (same hour): ${metrics.botCount}` : null,
    "",
    "This is often a scraper copying the public directory, or real visitors from a link or campaign. Your private doctor account data is not involved.",
    "",
    `When: ${timeRange}`,
    "",
    "Most visited pages:",
    topPagesBlock,
    "",
    "Top countries:",
    topCountriesBlock,
    "",
    `See more: ${internalUrl}`,
    "",
    "We won't send this alert again for 6 hours.",
    "",
    AUTOMATED_EMAIL_FOOTER_TEXT,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `<div style="font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.55;max-width:560px;">
  <p style="margin:0 0 16px;">Hi,</p>
  <p style="margin:0 0 20px;">More people than usual visited the public <strong>Finder</strong> in the last hour.</p>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin:0 0 20px;">
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#334155;">Summary</p>
    <p style="margin:0 0 6px;">Last hour: <strong>${metrics.humanCount}</strong> page views</p>
    <p style="margin:0 0 6px;">Usual for this time of day: about <strong>${roundedBaseline}</strong>/hour (${multiplierLabel} normal)</p>
    ${metrics.botCount > 0 ? `<p style="margin:0;font-size:13px;color:#64748b;">Automated crawlers (same hour): ${metrics.botCount}</p>` : ""}
  </div>

  <p style="margin:0 0 20px;font-size:14px;color:#475569;">This is often a scraper copying the public directory, or real visitors from a link or campaign. Your private doctor account data is not involved.</p>

  <p style="margin:0 0 6px;font-size:13px;font-weight:600;">When</p>
  <p style="margin:0 0 16px;">${escapeHtml(timeRange)}</p>

  <p style="margin:0 0 6px;font-size:13px;font-weight:600;">Most visited pages</p>
  <ul style="margin:0 0 16px;padding-left:20px;">${metrics.topPages
    .slice(0, 3)
    .map((row) => `<li>${escapeHtml(row.path)} (${row.count})</li>`)
    .join("") || "<li>—</li>"}</ul>

  <p style="margin:0 0 6px;font-size:13px;font-weight:600;">Top countries</p>
  <ul style="margin:0 0 20px;padding-left:20px;">${metrics.topCountries
    .slice(0, 3)
    .map((row) => `<li>${escapeHtml(row.country)} (${row.count})</li>`)
    .join("") || "<li>—</li>"}</ul>

  <p style="margin:0 0 20px;"><a href="${escapeHtml(internalUrl)}">Open internal dashboard</a></p>
  <p style="margin:0 0 20px;font-size:13px;color:#64748b;">We won't send this alert again for 6 hours.</p>

  <p style="margin:0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">${escapeHtml(AUTOMATED_EMAIL_FOOTER_TEXT)}</p>
</div>`;

  return { subject, text, html };
}

export function aggregateFinderTrafficRows(rows: FinderTrafficAggregateRow[]): {
  topPages: { path: string; count: number }[];
  topCountries: { country: string; count: number }[];
  sampleUserAgents: string[];
} {
  const pageCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const uaSet = new Set<string>();

  for (const row of rows) {
    if (!isFinderTrafficPath(row.page_path)) continue;
    pageCounts.set(row.page_path, (pageCounts.get(row.page_path) ?? 0) + 1);

    const country = (row.country ?? "").trim() || "Unknown";
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);

    if (!row.is_bot) {
      const ua = (row.user_agent ?? "").trim();
      if (ua && uaSet.size < 5) uaSet.add(ua.slice(0, 200));
    }
  }

  const topPages = [...pageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([path, count]) => ({ path, count }));

  const topCountries = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => ({ country, count }));

  return {
    topPages,
    topCountries,
    sampleUserAgents: [...uaSet],
  };
}
