const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 3;

/** Days until a professional's pro access ends (`professionals.pro_access_until`). */
export function computeTrialDaysRemaining(trialEndDate: Date, now = new Date()): number {
  return Math.ceil((trialEndDate.getTime() - now.getTime()) / DAY_MS);
}

export function getTrialStatus(daysRemaining: number): "expired" | "expiring_soon" | "active" {
  if (daysRemaining <= 0) return "expired";
  if (daysRemaining < EXPIRING_SOON_DAYS) return "expiring_soon";
  return "active";
}

