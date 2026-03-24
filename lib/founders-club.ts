import { createServiceRoleClient } from "@/lib/supabase-service";

export const MAX_FOUNDERS = 100;

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
    .select("id", { count: "exact", head: true });

  if (countRes.error) {
    // Safe fallback: default to standard pricing on data errors.
    return {
      currentUsersCount: MAX_FOUNDERS,
      spotsRemaining: 0,
      progressPercent: 100,
      offerAvailable: false,
    };
  }

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
