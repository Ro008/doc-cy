// app/api/doctor-settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { validateSpecialtySubmission } from "@/lib/specialty-submission";
import { isMasterSpecialty } from "@/lib/cyprus-specialties";
import { validateLanguageSelection } from "@/lib/cyprus-languages";
import { isCyprusDistrict } from "@/lib/cyprus-districts";
import {
  hasConfirmedClinicCoordinates,
  clinicLocationFromParts,
} from "@/lib/clinic-location";
import { parseOptionalCoordinates } from "@/lib/finder-distance";
import {
  BOOKING_HORIZON_OPTIONS_DAYS,
  DAY_NAMES,
  DEFAULT_BOOKING_HORIZON_DAYS,
  DEFAULT_MIN_NOTICE_HOURS,
  MIN_NOTICE_OPTIONS_HOURS,
  type DayKey,
  type WeeklySchedule,
} from "@/lib/doctor-settings";
import { locationScheduleColumns, sanitizeClinicLabel } from "@/lib/doctor-locations";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";

/** GET ?doctorId=xxx - returns current settings for the doctor (authenticated owner only) */
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  if (!doctorId) {
    return NextResponse.json(
      { message: "Missing doctorId." },
      { status: 400 }
    );
  }

  const { data: owned, error: ownErr } = await supabase
    .from("doctors")
    .select("id")
    .eq("id", doctorId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (ownErr || !owned) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("doctor_settings")
    .select("*")
    .eq("doctor_id", doctorId)
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      return NextResponse.json({ settings: null }, { status: 200 });
    }
    console.error(error);
    return NextResponse.json(
      { message: "Error fetching settings." },
      { status: 500 }
    );
  }

  return NextResponse.json({ settings: data });
}

/** POST - upsert doctor_settings + update doctors.phone, specialty, languages (owner only) */
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const b = body as {
    doctorId?: string;
    doctorPhone?: string | null;
    district?: string | null;
    clinicAddress?: string | null;
    clinicLatitude?: number | null;
    clinicLongitude?: number | null;
    clinicPlaceId?: string | null;
    town?: string | null;
    specialty?: string;
    /** true when chosen from master list (JSON boolean) */
    specialtyFromMaster?: boolean | string | number;
    /** Public profile “About” text (doctors.bio). */
    bio?: string | null;
    languages?: unknown;
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    saturday?: boolean;
    sunday?: boolean;
    startTime?: string; // legacy
    endTime?: string; // legacy
    weeklySchedule?: WeeklySchedule;
    breakEnabled?: boolean;
    breakStart?: string;
    breakEnd?: string;
    slotDurationMinutes?: number;
    bookingHorizonDays?: number;
    minimumNoticeHours?: number;
    holidayModeEnabled?: boolean;
    holidayStartDate?: string | null;
    holidayEndDate?: string | null;
    showPhonePublic?: boolean;
    locations?: Array<{
      id?: string;
      district?: string | null;
      clinicAddress?: string | null;
      clinicLatitude?: number | null;
      clinicLongitude?: number | null;
      clinicPlaceId?: string | null;
      town?: string | null;
      label?: string | null;
      weeklySchedule?: WeeklySchedule;
      monday?: boolean;
      tuesday?: boolean;
      wednesday?: boolean;
      thursday?: boolean;
      friday?: boolean;
      saturday?: boolean;
      sunday?: boolean;
      breakEnabled?: boolean;
      breakStart?: string;
      breakEnd?: string;
      slotDurationMinutes?: number;
      pauseOnlineBookings?: boolean;
    }>;
  };

  if (!b.doctorId) {
    return NextResponse.json(
      { message: "Missing doctorId." },
      { status: 400 }
    );
  }

  const doctorId = b.doctorId;

  const { data: owned, error: ownErr } = await supabase
    .from("doctors")
    .select("id")
    .eq("id", doctorId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (ownErr || !owned) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const specialtyRaw =
    typeof b.specialty === "string" ? b.specialty.trim() : "";
  let fromMasterFlag =
    b.specialtyFromMaster === true ||
    b.specialtyFromMaster === "true" ||
    b.specialtyFromMaster === 1;
  if (b.specialtyFromMaster === undefined || b.specialtyFromMaster === null) {
    fromMasterFlag = isMasterSpecialty(specialtyRaw);
  }
  const specResult = validateSpecialtySubmission(
    specialtyRaw,
    fromMasterFlag
  );
  if (specResult.ok === false) {
    return NextResponse.json({ message: specResult.message }, { status: 400 });
  }

  const BIO_MAX_CHARS = 1000;
  const bioRaw = typeof b.bio === "string" ? b.bio.trim() : "";
  if (b.bio !== undefined && bioRaw.length > BIO_MAX_CHARS) {
    return NextResponse.json(
      { message: `Bio must be ${BIO_MAX_CHARS} characters or fewer.` },
      { status: 400 },
    );
  }

  const langsParsed = validateLanguageSelection(b.languages);
  if (langsParsed.ok === false) {
    return NextResponse.json({ message: langsParsed.message }, { status: 400 });
  }
  const languages = langsParsed.value;
  const locationsPayload = Array.isArray(b.locations) ? b.locations : [];
  const primaryLocationInput = locationsPayload[0];
  const districtRaw = String(
    primaryLocationInput?.district ?? b.district ?? "",
  ).trim();
  if (!isCyprusDistrict(districtRaw)) {
    return NextResponse.json(
      { message: "Select a valid district." },
      { status: 400 }
    );
  }
  const clinicAddress = String(
    primaryLocationInput?.clinicAddress ?? b.clinicAddress ?? "",
  ).trim();
  const doctorPhoneTrimmed =
    typeof b.doctorPhone === "string" ? b.doctorPhone.trim() : "";
  if (Boolean(b.showPhonePublic) && doctorPhoneTrimmed.length === 0) {
    return NextResponse.json(
      { message: "Add a phone number before enabling public phone display." },
      { status: 400 },
    );
  }
  const clinicLocation = clinicLocationFromParts({
    address: clinicAddress,
    latitude: primaryLocationInput?.clinicLatitude ?? b.clinicLatitude,
    longitude: primaryLocationInput?.clinicLongitude ?? b.clinicLongitude,
    placeId: primaryLocationInput?.clinicPlaceId ?? b.clinicPlaceId,
    district: districtRaw,
    town:
      typeof primaryLocationInput?.town === "string"
        ? primaryLocationInput.town
        : typeof b.town === "string"
          ? b.town
          : null,
  });
  const coords = parseOptionalCoordinates(
    primaryLocationInput?.clinicLatitude ?? b.clinicLatitude,
    primaryLocationInput?.clinicLongitude ?? b.clinicLongitude,
  );
  const hasLegacyAddressOnly =
    clinicAddress.length > 0 &&
    !coords &&
    typeof b.clinicLatitude === "undefined" &&
    typeof b.clinicLongitude === "undefined";

  if (clinicAddress && !hasConfirmedClinicCoordinates(clinicLocation) && !hasLegacyAddressOnly) {
    return NextResponse.json(
      { message: "Please select your clinic from the Google suggestions." },
      { status: 400 },
    );
  }

  const toTime = (v: string | undefined, fallback: string) => {
    if (!v || typeof v !== "string") return fallback;
    const parts = v.trim().split(":");
    const h = parts[0]?.padStart(2, "0") ?? "09";
    const m = parts[1]?.padStart(2, "0") ?? "00";
    return `${h}:${m}:00`;
  };

  const slotMinutes = Number(b.slotDurationMinutes);
  const duration =
    Number.isInteger(slotMinutes) && slotMinutes > 0 ? slotMinutes : 30;
  const bookingHorizon = Number(b.bookingHorizonDays);
  const booking_horizon_days = BOOKING_HORIZON_OPTIONS_DAYS.includes(
    bookingHorizon as (typeof BOOKING_HORIZON_OPTIONS_DAYS)[number]
  )
    ? bookingHorizon
    : DEFAULT_BOOKING_HORIZON_DAYS;
  const minimumNotice = Number(b.minimumNoticeHours);
  const minimum_notice_hours = MIN_NOTICE_OPTIONS_HOURS.includes(
    minimumNotice as (typeof MIN_NOTICE_OPTIONS_HOURS)[number]
  )
    ? minimumNotice
    : DEFAULT_MIN_NOTICE_HOURS;

  const weeklySchedulePayload = DAY_NAMES.reduce((acc, day) => {
    const incoming = (b.weeklySchedule as WeeklySchedule | undefined)?.[day];
    const legacyEnabled = Boolean((b as Record<DayKey, unknown>)[day]);
    const startFallback = toTime(b.startTime, "09:00:00");
    const endFallback = toTime(b.endTime, "17:00:00");
    acc[day] = {
      enabled:
        typeof incoming?.enabled === "boolean" ? incoming.enabled : legacyEnabled,
      start_time: incoming?.start_time
        ? toTime(incoming.start_time, "09:00:00")
        : startFallback,
      end_time: incoming?.end_time
        ? toTime(incoming.end_time, "17:00:00")
        : endFallback,
    };
    return acc;
  }, {} as Record<DayKey, { enabled: boolean; start_time: string; end_time: string }>);

  const payload = {
    doctor_id: doctorId,
    monday: Boolean(b.monday),
    tuesday: Boolean(b.tuesday),
    wednesday: Boolean(b.wednesday),
    thursday: Boolean(b.thursday),
    friday: Boolean(b.friday),
    saturday: Boolean(b.saturday),
    sunday: Boolean(b.sunday),
    start_time: toTime(b.startTime, "09:00:00"),
    end_time: toTime(b.endTime, "17:00:00"),
    weekly_schedule: weeklySchedulePayload,
    break_start: b.breakEnabled ? toTime(b.breakStart, "13:00:00") : null,
    break_end: b.breakEnabled ? toTime(b.breakEnd, "14:00:00") : null,
    slot_duration_minutes: duration,
    booking_horizon_days,
    minimum_notice_hours,
    holiday_mode_enabled: Boolean(b.holidayModeEnabled),
    holiday_start_date: Boolean(b.holidayModeEnabled)
      ? (b.holidayStartDate ?? null)
      : null,
    holiday_end_date: Boolean(b.holidayModeEnabled)
      ? (b.holidayEndDate ?? null)
      : null,
    show_phone_public: Boolean(b.showPhonePublic),
    updated_at: new Date().toISOString(),
  };

  const legacyPayload = {
    doctor_id: doctorId,
    monday: Boolean(b.monday),
    tuesday: Boolean(b.tuesday),
    wednesday: Boolean(b.wednesday),
    thursday: Boolean(b.thursday),
    friday: Boolean(b.friday),
    start_time: toTime(b.startTime, "09:00:00"),
    end_time: toTime(b.endTime, "17:00:00"),
    break_start: b.breakEnabled ? toTime(b.breakStart, "13:00:00") : null,
    break_end: b.breakEnabled ? toTime(b.breakEnd, "14:00:00") : null,
    slot_duration_minutes: duration,
    updated_at: new Date().toISOString(),
  };

  const {
    data: dataFull,
    error: errorFull,
  } = await supabase
    .from("doctor_settings")
    .upsert(payload, { onConflict: "doctor_id" })
    .select()
    .single();

  let data = dataFull ?? null;
  if (errorFull) {
    // Missing new scheduling columns means advanced availability cannot be saved reliably.
    const errMsg = String((errorFull as any)?.message ?? "");
    const missingNewCols =
      /(saturday|sunday|weekly_schedule|pause_online_bookings|show_phone_public|holiday_mode_enabled|holiday_start_date|holiday_end_date|booking_horizon_days|minimum_notice_hours)/i.test(
        errMsg
      );

    if ((errorFull as { code?: string }).code === "42703" || missingNewCols) {
      return NextResponse.json(
        {
          message:
            "Database migration required for advanced schedule settings. Run supabase/doctor_settings_schedule_upgrade.sql in Supabase, then save again.",
        },
        { status: 500 }
      );
    }

    if ((errorFull as { code?: string }).code === "PGRST204") {
      const {
        data: dataLegacy,
        error: errorLegacy,
      } = await supabase
        .from("doctor_settings")
        .upsert(legacyPayload, { onConflict: "doctor_id" })
        .select()
        .single();

      if (errorLegacy) {
        console.error(errorLegacy);
      } else {
        data = dataLegacy ?? null;
      }
    }
  }

  if (!data) {
    console.error(errorFull);
    return NextResponse.json(
      { message: "Error saving settings." },
      { status: 500 }
    );
  }

  const phoneUpdateBase: {
    phone?: string | null;
    bio?: string | null;
    district: string;
    clinic_address: string | null;
    town?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    clinic_place_id?: string | null;
    specialty: string;
    languages: string[];
    is_specialty_approved: boolean;
    specialty_requires_standard_at: null;
  } = {
    district: districtRaw,
    clinic_address: clinicAddress || null,
    town: clinicAddress ? clinicLocation.town : null,
    latitude: clinicAddress ? clinicLocation.latitude : null,
    longitude: clinicAddress ? clinicLocation.longitude : null,
    clinic_place_id: clinicAddress ? clinicLocation.placeId : null,
    specialty: specResult.specialty,
    languages,
    is_specialty_approved: specResult.is_specialty_approved,
    specialty_requires_standard_at: null,
  };
  if (b.doctorPhone !== undefined) {
    phoneUpdateBase.phone = doctorPhoneTrimmed ? doctorPhoneTrimmed : null;
  }
  if (b.bio !== undefined) {
    phoneUpdateBase.bio = bioRaw.length > 0 ? bioRaw : null;
  }

  let docErr = (
    await supabase.from("doctors").update(phoneUpdateBase).eq("id", doctorId)
  ).error;

  if (
    docErr &&
    (docErr.code === "42703" ||
      docErr.code === "PGRST204" ||
      String(docErr.message ?? "").toLowerCase().includes("column"))
  ) {
    if (/town/i.test(String(docErr.message ?? ""))) {
      const { town: _town, ...withoutTown } = phoneUpdateBase;
      docErr = (await supabase.from("doctors").update(withoutTown).eq("id", doctorId)).error;
    }
    if (
      docErr &&
      (docErr.code === "42703" ||
        docErr.code === "PGRST204" ||
        String(docErr.message ?? "").toLowerCase().includes("column"))
    ) {
      const { latitude: _lat, longitude: _lon, clinic_place_id: _placeId, town: _town, ...legacyPhoneUpdate } =
        phoneUpdateBase;
      docErr = (
        await supabase.from("doctors").update(legacyPhoneUpdate).eq("id", doctorId)
      ).error;
    }
  }

  if (docErr) {
    console.error("[DocCy] Failed to update doctors row", docErr);
    return NextResponse.json(
      {
        message:
          docErr.message?.includes("languages") || docErr.code === "42703"
            ? "Database missing `languages` column. Run supabase/doctors_add_languages.sql in Supabase."
            : "Error updating professional profile.",
      },
      { status: 500 }
    );
  }

  const existingLocations = await loadDoctorLocations(supabase, doctorId);
  const locationInputs =
    locationsPayload.length > 0
      ? locationsPayload
      : [
          {
            id: primaryDoctorLocation(existingLocations)?.id,
            district: districtRaw,
            clinicAddress,
            clinicLatitude: b.clinicLatitude,
            clinicLongitude: b.clinicLongitude,
            clinicPlaceId: b.clinicPlaceId,
            town: typeof b.town === "string" ? b.town : null,
            weeklySchedule: b.weeklySchedule,
            monday: b.monday,
            tuesday: b.tuesday,
            wednesday: b.wednesday,
            thursday: b.thursday,
            friday: b.friday,
            saturday: b.saturday,
            sunday: b.sunday,
            breakEnabled: b.breakEnabled,
            breakStart: b.breakStart,
            breakEnd: b.breakEnd,
            slotDurationMinutes: b.slotDurationMinutes,
          },
        ];

  for (let index = 0; index < locationInputs.length; index += 1) {
    const loc = locationInputs[index];
    if (!loc) continue;
    const locAddress = String(loc.clinicAddress ?? "").trim();
    const locDistrict = String(loc.district ?? "").trim();
    const locClinic = clinicLocationFromParts({
      address: locAddress,
      latitude: loc.clinicLatitude,
      longitude: loc.clinicLongitude,
      placeId: loc.clinicPlaceId,
      district: locDistrict,
      town: typeof loc.town === "string" ? loc.town : null,
    });
    if (locAddress && locDistrict && !isCyprusDistrict(locDistrict) && !locClinic.district) {
      return NextResponse.json(
        { message: "Select a valid district for each clinic." },
        { status: 400 },
      );
    }
    const schedule = locationScheduleColumns({
      weeklySchedule: loc.weeklySchedule,
      monday: loc.monday,
      tuesday: loc.tuesday,
      wednesday: loc.wednesday,
      thursday: loc.thursday,
      friday: loc.friday,
      saturday: loc.saturday,
      sunday: loc.sunday,
      breakEnabled: loc.breakEnabled,
      breakStart: loc.breakStart,
      breakEnd: loc.breakEnd,
      slotDurationMinutes: loc.slotDurationMinutes,
      pauseOnlineBookings: loc.pauseOnlineBookings,
    });
    const locationPatch: Record<string, unknown> = {
      ...schedule,
      district: locClinic.district ?? (locDistrict || null),
      clinic_address: locAddress || null,
      town: locAddress ? locClinic.town : null,
      latitude: locAddress ? locClinic.latitude : null,
      longitude: locAddress ? locClinic.longitude : null,
      clinic_place_id: locAddress ? locClinic.placeId : null,
      updated_at: new Date().toISOString(),
    };
    if (typeof loc.label === "string") {
      locationPatch.label = sanitizeClinicLabel(loc.label);
    }
    const locationId = String(loc.id ?? "").trim();
    const matched = existingLocations.find((row) => row.id === locationId);
    if (matched) {
      const { error: locErr } = await supabase
        .from("doctor_locations")
        .update(locationPatch)
        .eq("id", matched.id)
        .eq("doctor_id", doctorId);
      if (locErr) {
        console.error("[DocCy] Failed to update doctor location", locErr);
        return NextResponse.json(
          { message: "Error saving clinic settings." },
          { status: 500 },
        );
      }
    } else if (index === 0) {
      const primary = primaryDoctorLocation(existingLocations);
      if (primary) {
        const { error: locErr } = await supabase
          .from("doctor_locations")
          .update(locationPatch)
          .eq("id", primary.id)
          .eq("doctor_id", doctorId);
        if (locErr) {
          console.error("[DocCy] Failed to update primary doctor location", locErr);
          return NextResponse.json(
            { message: "Error saving clinic settings." },
            { status: 500 },
          );
        }
      }
    }
  }

  return NextResponse.json({ settings: data }, { status: 200 });
}
