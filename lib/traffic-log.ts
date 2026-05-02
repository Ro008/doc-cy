import type {NextRequest} from "next/server";

/** Sent by Playwright when DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET matches server env. */
export const TRAFFIC_LOG_SUPPRESS_HEADER = "x-doccy-suppress-traffic-log";
export const TRAFFIC_LOG_SIGNATURE_HEADER = "x-doccy-traffic-log-signature";
export const TRAFFIC_LOG_TIMESTAMP_HEADER = "x-doccy-traffic-log-timestamp";

const TRAFFIC_LOG_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function shouldSuppressTrafficLog(req: NextRequest): boolean {
  const secret = process.env.DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get(TRAFFIC_LOG_SUPPRESS_HEADER)?.trim() === secret;
}

function getTrafficLogSigningSecret(): string | null {
  return (
    process.env.DOC_CY_TRAFFIC_LOG_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function signTrafficLogRequest(
  body: string,
  timestamp = String(Date.now())
): Promise<{timestamp: string; signature: string} | null> {
  const secret = getTrafficLogSigningSecret();
  if (!secret) return null;
  return {
    timestamp,
    signature: await hmacSha256Hex(secret, `${timestamp}.${body}`),
  };
}

export async function verifyTrafficLogRequest(
  headers: Headers,
  body: string,
  nowMs = Date.now()
): Promise<boolean> {
  const secret = getTrafficLogSigningSecret();
  if (!secret) return false;

  const timestamp = headers.get(TRAFFIC_LOG_TIMESTAMP_HEADER)?.trim();
  const signature = headers.get(TRAFFIC_LOG_SIGNATURE_HEADER)?.trim();
  if (!timestamp || !signature) return false;

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(nowMs - timestampMs) > TRAFFIC_LOG_MAX_CLOCK_SKEW_MS) return false;

  const expected = await hmacSha256Hex(secret, `${timestamp}.${body}`);
  return constantTimeEqual(expected, signature);
}
