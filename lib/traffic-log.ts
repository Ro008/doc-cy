import type {NextRequest} from "next/server";

/** Sent by Playwright when DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET matches server env. */
export const TRAFFIC_LOG_SUPPRESS_HEADER = "x-doccy-suppress-traffic-log";

/** Legacy httpOnly cookie (middleware used to Set-Cookie this on the HTML response). */
export const TRAFFIC_SESSION_COOKIE = "doccy-traffic-session";

/**
 * JS-readable session cookie. Set in the browser after HTML, never via
 * Set-Cookie on the document response, so the first finder HTML stays cacheable.
 */
export const TRAFFIC_SESSION_JS_COOKIE = "doccy-ts";

export const TRAFFIC_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type CookieReader = {
  get(name: string): {value: string} | undefined;
};

export function trafficSessionIdFromCookieStore(cookies: CookieReader): string | null {
  const legacy = cookies.get(TRAFFIC_SESSION_COOKIE)?.value?.trim();
  if (legacy) return legacy;
  const js = cookies.get(TRAFFIC_SESSION_JS_COOKIE)?.value?.trim();
  return js || null;
}

/** Inline head/body script: persist session id for later navigations without blocking TTFB. */
export function trafficSessionPersistInlineScript(): string {
  const name = TRAFFIC_SESSION_JS_COOKIE;
  const maxAge = TRAFFIC_SESSION_MAX_AGE_SECONDS;
  return `(function(){try{if(document.cookie.indexOf(${JSON.stringify(`${name}=`)})!==-1)return;var id=(crypto.randomUUID&&crypto.randomUUID())||String(Date.now());document.cookie=${JSON.stringify(`${name}=`)}+id+";Path=/;Max-Age=${maxAge};SameSite=Lax"+(location.protocol==="https:"?";Secure":"");}catch(e){}})();`;
}

export function shouldSuppressTrafficLog(req: NextRequest): boolean {
  const secret = process.env.DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get(TRAFFIC_LOG_SUPPRESS_HEADER)?.trim() === secret;
}
