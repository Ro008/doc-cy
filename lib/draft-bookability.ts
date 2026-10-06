import { formatInTimeZone } from "date-fns-tz";
import type { SupabaseClient } from "@supabase/supabase-js";

import { countOpenRequestsWithProfessional, type AppointmentDraftRow } from "@/lib/appointment-drafts";
import { CY_TZ } from "@/lib/appointments";
import { checkOnlineBookingSlot, type SlotCheckResult } from "@/lib/online-booking-slot-check";

export type DraftBookability =
  | { ok: true; slot: Extract<SlotCheckResult, { ok: true }>; code?: undefined; status?: undefined; message?: undefined }
  | { ok: false; code: string; status: number; message: string; slot?: undefined };

/**
 * Can this draft still become a request? The time must still be free and bookable, and
 * the email must have no request waiting with her. Checked when the link page opens (so
 * it never offers "Confirm my request" for a time that's gone) and again on confirm
 * (manual test B5, user 2026-10-06).
 */
export async function draftBookability(
  supabase: SupabaseClient,
  draft: Pick<AppointmentDraftRow, "professional_id" | "clinic_id" | "appointment_datetime" | "patient_email">,
): Promise<DraftBookability> {
  const slot = await checkOnlineBookingSlot(supabase, {
    professionalId: draft.professional_id,
    appointmentLocal: formatInTimeZone(new Date(draft.appointment_datetime), CY_TZ, "yyyy-MM-dd'T'HH:mm"),
    clinicId: draft.clinic_id,
  });
  if (!slot.ok) return { ok: false, code: slot.code, status: slot.status, message: slot.message };

  const open = await countOpenRequestsWithProfessional(supabase, draft.professional_id, draft.patient_email);
  if (open > 0) {
    return {
      ok: false,
      code: "open_request_exists",
      status: 409,
      message: "You already have a request waiting with this professional.",
    };
  }
  return { ok: true, slot };
}
