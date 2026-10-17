import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { getTranslations } from "next-intl/server";
import type { FinderPopupClinic, FinderPopupData } from "@/lib/finder-profile-popup";
import type { BookingViewerMode } from "@/lib/booking-viewer";
import {
  ACCOUNT_SETTINGS_FALLBACK,
  clinicTitleOrFallback,
  locationToSettingsRow,
} from "@/lib/doctor-locations";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { hasProAccess } from "@/lib/pro-access";
import { loadProfessionalAccountSettings } from "@/lib/professional-account-settings";
import { loadProfileHeadline } from "@/lib/profile-headline-server";
import { clinicForRenderedLocation } from "@/lib/public/finder-card-clinic-match";
import { loadFinderRegisteredClinics } from "@/lib/public/load-finder-registered-clinics";
import { loadPublicPersonalMobile } from "@/lib/public/load-profile-personal-mobile";
import { clinicChooserRows } from "@/lib/public/profile-clinic-availability";
import { bookingPropsForSettingsRow, clinicAvailabilityDays } from "@/lib/public/professional-booking-props";
import { loadProfessionalTakenSlotTimes } from "@/lib/public/professional-taken-slots";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * What the Finder's profile pop-up loads for one registered professional (mockup F; user,
 * 2026-10-17): her headline, services and, per clinic, the calendar's rules and her next
 * free time, read the way her profile reads them. Who she is (photo, name, specialties)
 * comes from the card. Nothing her profile does not show: no contact details (the mobile
 * is only "there is one"; the number comes from the reveal route on a click).
 */
export async function loadFinderProfilePopupData(
  slug: string,
  viewerMode: (professionalId: string) => Promise<BookingViewerMode>,
): Promise<FinderPopupData | "not_found" | "unavailable"> {
  const supabase = createServiceRoleClient({ fresh: true });
  if (!supabase) return "unavailable";

  const { data: professional, error } = await supabase
    .from("professionals")
    .select("id, pro_access_until")
    .eq("is_registered", true)
    .eq("is_archived", false)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[DocCy][professional-booking] professional_read_failed", error.message);
    return "unavailable";
  }
  if (!professional) return "not_found";
  const professionalId = String(professional.id);
  // Access ended: no online booking (the booking routes refuse too).
  const accessEnded = !hasProAccess(professional.pro_access_until);

  const [locations, { settings }, mobile, headline, { data: serviceRows }, registeredClinics, mode, t, bookingT] =
    await Promise.all([
      loadDoctorLocations(professionalId),
      loadProfessionalAccountSettings(supabase, professionalId),
      loadPublicPersonalMobile(supabase, professionalId),
      loadProfileHeadline(supabase, professionalId),
      supabase
        .from("professional_services")
        .select("id, name")
        .eq("professional_id", professionalId)
        .order("created_at", { ascending: true }),
      loadFinderRegisteredClinics(professionalId),
      viewerMode(professionalId),
      getTranslations({ locale: "en", namespace: "DoctorProfilePage" }),
      getTranslations({ locale: "en", namespace: "BookingPage" }),
    ]);

  const rows = locations.map((location) => locationToSettingsRow(location, settings ?? ACCOUNT_SETTINGS_FALLBACK));
  const takenSlotTimes = await loadProfessionalTakenSlotTimes(
    supabase,
    professionalId,
    rows.map((row) => row.booking_horizon_days),
  );

  const linkedClinics = registeredClinics.byProfessionalId.get(professionalId) ?? [];
  const sources = locations.map((location, index) => {
    const booking = bookingPropsForSettingsRow(rows[index]!, { accessEnded });
    return {
      location,
      booking,
      id: location.id,
      title: clinicTitleOrFallback(location.label, bookingT("clinicNumber", { number: index + 1 })),
      place: String(location.town ?? "").trim() || String(location.district ?? "").trim() || null,
      paused: Boolean(rows[index]!.pause_online_bookings),
      days: clinicAvailabilityDays(booking, takenSlotTimes),
    };
  });
  const chooser = clinicChooserRows({
    clinics: sources,
    selectedId: null,
    bookingOffEverywhere: accessEnded,
    locale: "en",
    slug,
  });

  const clinics: FinderPopupClinic[] = sources.map((source, index) => {
    const next = chooser[index]?.next ?? null;
    const clinic = clinicForRenderedLocation({
      locationId: source.id,
      locationAddress: source.location.clinic_address,
      byLocationId: registeredClinics.byLocationId,
      candidates: linkedClinics,
    });
    let day: string | null = null;
    if (next) {
      const [y, m, d] = next.dateKey.split("-").map(Number);
      day = next.isToday ? t("nextAvailabilityToday") : format(new Date(y, m - 1, d), "EEE d MMM", { locale: enGB });
    }
    return {
      id: source.id,
      title: source.title,
      place: source.place,
      bookable: Boolean(chooser[index]?.bookable),
      next: next && day ? { day, time: next.fromTime, dateKey: next.dateKey, slotKey: next.slotKey } : null,
      booking: source.booking,
      publicPhoneAvailable: Boolean(clinic?.hasPhone),
    };
  });

  return {
    ok: true,
    professionalId,
    headline,
    hasPersonalMobile: Boolean(mobile),
    viewerMode: mode,
    services: (serviceRows ?? [])
      .map((row) => ({ id: String(row.id), name: String(row.name ?? "").trim() }))
      .filter((row) => row.name.length > 0),
    takenSlotTimes,
    clinics,
  };
}
