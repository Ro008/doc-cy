import type {NextRequest} from "next/server";

/** Sent by Playwright when DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET matches server env. */
export const TRAFFIC_LOG_SUPPRESS_HEADER = "x-doccy-suppress-traffic-log";

export function shouldSuppressTrafficLog(req: NextRequest): boolean {
  const secret = process.env.DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get(TRAFFIC_LOG_SUPPRESS_HEADER)?.trim() === secret;
}
