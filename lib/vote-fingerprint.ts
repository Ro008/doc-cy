import { createHmac } from "node:crypto";

/**
 * Accepts a plain `.get(name)` header source so callers can pass either an
 * API route's `req.headers` or the `headers()` result from a Server
 * Component (neither has a full `Request` to hand over).
 */
export function getClientIp(headers: Pick<Headers, "get">): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = headers.get("x-real-ip")?.trim();
  if (xri) return xri;
  return "";
}

export function voterFingerprint(scope: string, ip: string): string | null {
  const secret = process.env.DOC_CY_VOTE_FINGERPRINT_SECRET?.trim();
  if (!secret || !ip) return null;
  return createHmac("sha256", secret).update(`${ip}|${scope}`).digest("hex");
}
