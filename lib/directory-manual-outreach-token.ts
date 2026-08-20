import { createHmac, timingSafeEqual } from "node:crypto";

export function normalizeOutreachEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

export function resolveOutreachUnsubscribeSecret(): string | null {
  const dedicated = process.env.OUTREACH_UNSUBSCRIBE_SECRET?.trim();
  if (dedicated) return dedicated;
  const cron = process.env.CRON_SECRET?.trim();
  return cron || null;
}

export function createOutreachUnsubscribeToken(input: {
  manualId: string;
  email: string;
  secret: string;
}): string {
  const payload = `${String(input.manualId).trim().toLowerCase()}:${normalizeOutreachEmail(input.email)}`;
  return createHmac("sha256", input.secret).update(payload).digest("hex").slice(0, 32);
}

export function outreachUnsubscribeTokenIsValid(input: {
  manualId: string;
  email: string;
  token: string;
  secret: string;
}): boolean {
  const expected = createOutreachUnsubscribeToken(input);
  const provided = String(input.token ?? "").trim().toLowerCase();
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
