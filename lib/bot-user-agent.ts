/**
 * Heuristic bot / automated client detection for traffic analytics (Edge-safe).
 * False negatives (missed bots) are acceptable; avoid flagging normal browsers.
 */
const BOT_OR_AUTOMATION = new RegExp(
  [
    "googlebot|google-inspectiontool|googleother|google-read-aloud|googleproducer|storegooglebot",
    "bingbot|msnbot|slurp|duckduckbot|baiduspider|yandexbot|yandex\\.com\\/bots",
    "facebookexternalhit|facebot|twitterbot|linkedinbot|pinterest|slackbot|discordbot|telegrambot",
    "applebot|amazonbot|bytespider|petalbot|gptbot|chatgpt-user|anthropic|claude-web|oai-searchbot",
    "ahrefs|semrush|mj12bot|dotbot|rogerbot|screaming\\s+frog|sitebulb|uptimerobot|pingdom|statuscake|betterstack",
    "headlesschrome|headless|phantomjs|playwright|puppeteer|selenium|webdriver|lighthouse|chrome-lighthouse",
    "curl\\/|wget|^java\\/|libwww-perl|python-requests|axios|aiohttp|httpclient|go-http|okhttp|undici",
    "scrapy|feedfetcher|feedburner|ia_archiver|archive\\.org_bot|ccbot|diffbot|embedly|prerender",
  ].join("|"),
  "i"
);

export function isLikelyBotUserAgent(ua: string | null | undefined): boolean {
  const s = ua?.trim();
  if (!s || s.length < 16) {
    return false;
  }
  return BOT_OR_AUTOMATION.test(s);
}
