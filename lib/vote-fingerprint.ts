import { createHmac } from "node:crypto";

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip")?.trim();
  if (xri) return xri;
  return "";
}

export function voterFingerprint(scope: string, ip: string): string | null {
  const secret = process.env.DOC_CY_VOTE_FINGERPRINT_SECRET?.trim();
  if (!secret || !ip) return null;
  return createHmac("sha256", secret).update(`${ip}|${scope}`).digest("hex");
}
