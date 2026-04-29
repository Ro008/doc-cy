import { createServiceRoleClient } from "@/lib/supabase-service";

export const MAX_FOUNDERS = 100;
const MARKETING_INCLUDED_DOCTOR_SLUGS = ["andreas-nikos", "kasia-petrova"] as const;

export type FoundersAvailability = {
  currentUsersCount: number;
  spotsRemaining: number;
  progressPercent: number;
  offerAvailable: boolean;
};

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

export async function getFoundersAvailability(): Promise<FoundersAvailability> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    // Safe fallback: never undersell if server config is missing.
    return {
      currentUsersCount: MAX_FOUNDERS,
      spotsRemaining: 0,
      progressPercent: 100,
      offerAvailable: false,
    };
  }

  const countRes = await supabase
    .from("doctors")
    .select("id", { count: "exact", head: true })
    .eq("subscription_tier", "founder")
    .eq("status", "verified");

  if (countRes.error) {
    // Safe fallback: default to standard pricing on data errors.
    return {
      currentUsersCount: MAX_FOUNDERS,
      spotsRemaining: 0,
      progressPercent: 100,
      offerAvailable: false,
    };
  }

  let currentUsersCount = countRes.count ?? 0;

  // Marketing override: explicitly count selected seeded profiles even if
  // they are no longer founder+verified after test/ops adjustments.
  const marketingRes = await supabase
    .from("doctors")
    .select("id, slug, subscription_tier, status")
    .in("slug", [...MARKETING_INCLUDED_DOCTOR_SLUGS]);

  if (!marketingRes.error && Array.isArray(marketingRes.data)) {
    const extraMarketingCount = marketingRes.data.filter((doctor) => {
      const alreadyCounted = doctor.subscription_tier === "founder" && doctor.status === "verified";
      return !alreadyCounted;
    }).length;
    currentUsersCount += extraMarketingCount;
  }

  currentUsersCount = clamp(currentUsersCount, 0, MAX_FOUNDERS);
  const spotsRemaining = clamp(MAX_FOUNDERS - currentUsersCount, 0, MAX_FOUNDERS);
  const progressPercent = clamp(((MAX_FOUNDERS - spotsRemaining) / MAX_FOUNDERS) * 100, 0, 100);

  return {
    currentUsersCount,
    spotsRemaining,
    progressPercent,
    offerAvailable: spotsRemaining > 0,
  };
}
