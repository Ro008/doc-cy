import { cache } from "react";

import { loadFinderCardAvailabilityByDoctorId } from "@/lib/public/load-doctor-next-available-slot";
import type { FinderLocationAvailability } from "@/lib/public/load-doctor-next-available-slot";
import type { DoctorLocationRow } from "@/lib/doctor-locations";
import type { PublicAvailabilityCalendar } from "@/lib/public/compute-public-booking-slots";
import { createServiceRoleClient } from "@/lib/supabase-service";

export { finderAvailabilityRequestKey } from "@/lib/public/finder-availability-request-key";

type FinderAvailabilityBatch = {
  paused: Map<string, boolean>;
  calendars: Map<string, PublicAvailabilityCalendar>;
  locationsByDoctorId: Map<string, DoctorLocationRow[]>;
  byLocationId: Map<string, FinderLocationAvailability>;
};

/**
 * Request-memoized batch so every streamed finder card shares one settings + slots load.
 */
export const loadFinderAvailabilityForRequest = cache(
  async (doctorIdsKey: string): Promise<FinderAvailabilityBatch> => {
    const ids = doctorIdsKey.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      return {
        paused: new Map(),
        calendars: new Map(),
        locationsByDoctorId: new Map(),
        byLocationId: new Map(),
      };
    }
    const supabase = createServiceRoleClient();
    if (!supabase) {
      return {
        paused: new Map(),
        calendars: new Map(),
        locationsByDoctorId: new Map(),
        byLocationId: new Map(),
      };
    }
    return loadFinderCardAvailabilityByDoctorId(supabase, ids);
  },
);
