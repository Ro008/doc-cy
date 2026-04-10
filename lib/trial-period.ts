const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TRIAL_DAYS = 90;
const EXPIRING_SOON_DAYS = 3;

/**
 * Backend source of truth for trial duration.
 * Set TRIAL_PERIOD_DAYS in env to override (default 90 days).
 */
export function getTrialPeriodDays(): number {
  const raw = process.env.TRIAL_PERIOD_DAYS?.trim();
  if (!raw) return DEFAULT_TRIAL_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TRIAL_DAYS;
  return Math.floor(parsed);
}

export function computeTrialEndDate(createdAtIso: string, trialDays = getTrialPeriodDays()): Date {
  const createdAt = new Date(createdAtIso);
  return new Date(createdAt.getTime() + trialDays * DAY_MS);
}

export function computeTrialDaysRemaining(trialEndDate: Date, now = new Date()): number {
  return Math.ceil((trialEndDate.getTime() - now.getTime()) / DAY_MS);
}

export function getTrialStatus(daysRemaining: number): "expired" | "expiring_soon" | "active" {
  if (daysRemaining <= 0) return "expired";
  if (daysRemaining < EXPIRING_SOON_DAYS) return "expiring_soon";
  return "active";
}

