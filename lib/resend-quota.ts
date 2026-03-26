import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";

/**
 * Resend attaches sending quotas to API responses (see Usage Limits docs).
 * We use Node's https client instead of fetch: some Next/undici setups do not
 * surface custom response headers (e.g. x-resend-monthly-quota) on cross-origin fetch.
 */
export type ResendAccountQuota = {
  monthlyUsed: number;
  /** Only present on Resend free tier responses. */
  dailyUsed: number | null;
};

export type ResendQuotaFailureReason =
  | "missing_api_key"
  | "http_error"
  | "no_quota_headers";

export type ResendQuotaFetchResult =
  | { ok: true; quota: ResendAccountQuota }
  | { ok: false; reason: ResendQuotaFailureReason };

function headerValue(
  headers: IncomingHttpHeaders,
  name: string
): string | undefined {
  const v = headers[name.toLowerCase()];
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function parseQuotaFromHeaders(
  headers: IncomingHttpHeaders
): ResendAccountQuota | null {
  const monthlyRaw = headerValue(headers, "x-resend-monthly-quota");
  if (monthlyRaw == null || monthlyRaw === "") {
    return null;
  }
  const monthlyUsed = Number.parseInt(monthlyRaw, 10);
  if (Number.isNaN(monthlyUsed) || monthlyUsed < 0) {
    return null;
  }

  const dailyRaw = headerValue(headers, "x-resend-daily-quota");
  let dailyUsed: number | null = null;
  if (dailyRaw != null && dailyRaw !== "") {
    const d = Number.parseInt(dailyRaw, 10);
    if (!Number.isNaN(d) && d >= 0) {
      dailyUsed = d;
    }
  }

  return { monthlyUsed, dailyUsed };
}

function resendGet(
  path: string,
  apiKey: string
): Promise<{ statusCode: number; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.resend.com",
        port: 443,
        path,
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/** Try several read-only endpoints until quota headers appear. */
const QUOTA_PROBE_PATHS = ["/domains", "/emails", "/audiences"];

export async function fetchResendAccountQuota(): Promise<ResendQuotaFetchResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" };
  }

  try {
    let saw2xx = false;
    for (const path of QUOTA_PROBE_PATHS) {
      const { statusCode, headers } = await resendGet(path, apiKey);
      if (statusCode < 200 || statusCode >= 300) {
        continue;
      }
      saw2xx = true;
      const quota = parseQuotaFromHeaders(headers);
      if (quota) {
        return { ok: true, quota };
      }
    }
    return {
      ok: false,
      reason: saw2xx ? "no_quota_headers" : "http_error",
    };
  } catch {
    return { ok: false, reason: "http_error" };
  }
}
