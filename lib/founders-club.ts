import { createServiceRoleClient } from "@/lib/supabase-service";

export const MAX_FOUNDERS = 50;

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

  // `is_test_profile` is excluded deliberately: this number is public, shown on the
  // marketing page as spots remaining. A QA or smoke profile must never move it.
  const countRes = await supabase
    .from("professionals")
    .select("id", { count: "exact", head: true })
    .eq("subscription_tier", "founder")
    .eq("status", "verified")
    .eq("is_registered", true)
    .eq("is_test_profile", false);

  if (countRes.error) {
    // Safe fallback: default to standard pricing on data errors.
    return {
      currentUsersCount: MAX_FOUNDERS,
      spotsRemaining: 0,
      progressPercent: 100,
      offerAvailable: false,
    };
  }

  // No slug overrides here. There used to be one that added a seeded QA doctor to this
  // count even after it stopped being founder+verified, which meant a test profile was
  // inflating a public number. The count is now exactly the real founders.
  const currentUsersCount = clamp(countRes.count ?? 0, 0, MAX_FOUNDERS);
  const spotsRemaining = clamp(MAX_FOUNDERS - currentUsersCount, 0, MAX_FOUNDERS);
  const progressPercent = clamp(((MAX_FOUNDERS - spotsRemaining) / MAX_FOUNDERS) * 100, 0, 100);

  return {
    currentUsersCount,
    spotsRemaining,
    progressPercent,
    offerAvailable: spotsRemaining > 0,
  };
}
