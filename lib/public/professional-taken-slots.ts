import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import {
  OCCUPIED_BATCH_RPC,
  takenSlotTimesFor,
  type OccupiedRow,
} from "@/lib/public/load-doctor-next-available-slot";
import { widestBookingHorizonDays } from "@/lib/public/profile-clinic-availability";

/**
 * Her taken slot starts (Cyprus "yyyy-MM-ddTHH:mm") at every clinic: one professional, one
 * agenda, so a visit in any clinic blocks the time. Loaded once, far enough ahead for the
 * clinic with the longest horizon. Her profile and the Finder's pop-up both read it (busy
 * instants only: RLS blocks direct reads of appointments).
 */
export async function loadProfessionalTakenSlotTimes(
  supabase: SupabaseClient,
  professionalId: string,
  horizons: ReadonlyArray<number | null | undefined>,
): Promise<string[]> {
  const nowUtc = new Date();
  const fromIso = new Date(nowUtc.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const lastBookableDay = addDays(utcToZonedTime(nowUtc, CY_TZ), widestBookingHorizonDays(horizons));
  // End of the day after the last bookable date (Cyprus): covers late slots and long visits,
  // as POST /api/appointments does.
  const toIso = zonedTimeToUtc(
    `${format(addDays(lastBookableDay, 1), "yyyy-MM-dd")}T23:59:59.999`,
    CY_TZ,
  ).toISOString();

  const { data, error } = await supabase.rpc(OCCUPIED_BATCH_RPC, {
    p_professional_ids: [professionalId],
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) {
    console.error(`[DocCy] ${OCCUPIED_BATCH_RPC} failed:`, error);
  }
  return takenSlotTimesFor((data ?? []) as OccupiedRow[], { professionalId, toIso });
}
