/**
 * True only for Cloudflare's interstitial, not for scripts injected on every
 * proxied page (`/cdn-cgi/challenge-platform/scripts/jsd/...`). Matching that
 * path false-failed prod nightly after Bot Fight Mode went live (2026-08-10).
 */
export function isCloudflareChallengePage(title: string, html: string): boolean {
  if (/just a moment|attention required|checking your browser/i.test(title)) {
    return true;
  }
  return /cf-browser-verification|cf-challenge-running|id=["']challenge-form["']/i.test(
    html,
  );
}
