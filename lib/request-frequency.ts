import { formatInTimeZone } from "date-fns-tz";

/**
 * How often a professional can change a setting (user, 2026-10-12). The limits live on
 * `request_types` and the database refuses a change over them (`request_frequency_check`,
 * run by `request_submit`): SQLSTATE DC429, with the time she can change it again in the
 * error's details (UTC) and the kind in its hint.
 */
export const TOO_OFTEN_SQLSTATE = "DC429";

const CYPRUS_TZ = "Europe/Nicosia";

/** "window": too many in the period. "after_approval": the wait after an approved request. */
export type TooOftenKind = "window" | "after_approval";

export type TooOftenRefusal = {
  status: 429;
  message: string;
  code: "too_often";
  /** When she can make the change again (ISO), or null when the database did not say. */
  retryAt: string | null;
};

type DbError = { code?: string | null; details?: string | null; hint?: string | null };

export function tooOftenMessage(retryAt: string | null, kind: TooOftenKind): string {
  const at = retryAt ? new Date(retryAt) : null;
  const known = at && !Number.isNaN(at.getTime()) ? at : null;
  if (kind === "after_approval") {
    const when = known ? ` You can send a new one from ${formatInTimeZone(known, CYPRUS_TZ, "dd/MM/yyyy")}.` : "";
    return `Your last request of this kind was approved recently.${when} If it is urgent, contact us.`;
  }
  const when = known
    ? ` You can make it again on ${formatInTimeZone(known, CYPRUS_TZ, "dd/MM/yyyy")} at ${formatInTimeZone(known, CYPRUS_TZ, "HH:mm")}.`
    : "";
  return `You have reached the limit for this change.${when} If it is urgent, contact us.`;
}

/** The answer for a change refused as too frequent, or null for any other error (or none). */
export function tooOftenRefusal(error: DbError | null | undefined): TooOftenRefusal | null {
  if (!error || error.code !== TOO_OFTEN_SQLSTATE) return null;
  const stated = String(error.details ?? "").trim();
  const retryAt = stated && !Number.isNaN(new Date(stated).getTime()) ? new Date(stated).toISOString() : null;
  const kind: TooOftenKind = error.hint === "after_approval" ? "after_approval" : "window";
  return { status: 429, message: tooOftenMessage(retryAt, kind), code: "too_often", retryAt };
}
