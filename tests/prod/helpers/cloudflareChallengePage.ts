/**
 * True only for Cloudflare's interstitial, not for scripts injected on every
 * proxied page (`/cdn-cgi/challenge-platform/scripts/jsd/...`). Matching that
 * path false-failed prod nightly after Bot Fight Mode went live (2026-08-10).
 */
/**
 * What to do when Cloudflare's interstitial won't clear. "skip" only when the run opts in
 * with PLAYWRIGHT_CLOUDFLARE_CHALLENGE=skip: the nightly edge lane, whose GitHub IPs Bot
 * Fight Mode challenges while the Vercel origin lane is the blocking check. Everything else
 * (origin, preview, local) fails, so a challenge a real visitor would see is never hidden.
 */
export function cloudflareChallengeAction(
  env: Record<string, string | undefined>,
): "skip" | "fail" {
  return env.PLAYWRIGHT_CLOUDFLARE_CHALLENGE === "skip" ? "skip" : "fail";
}

export function isCloudflareChallengePage(title: string, html: string): boolean {
  if (/just a moment|attention required|checking your browser/i.test(title)) {
    return true;
  }
  return /cf-browser-verification|cf-challenge-running|id=["']challenge-form["']/i.test(
    html,
  );
}
