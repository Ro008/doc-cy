/** Normalizes DB `subscription_tier` for founder UI (case/whitespace safe). */
export function isFounderSubscriptionTier(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === "founder";
}
