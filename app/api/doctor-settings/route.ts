// app/api/doctor-settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { validateLanguageSelection } from "@/lib/cyprus-languages";
import {
  BOOKING_HORIZON_OPTIONS_DAYS,
  DAY_NAMES,
  DEFAULT_BOOKING_HORIZON_DAYS,
  DEFAULT_MIN_NOTICE_HOURS,
  MIN_NOTICE_OPTIONS_HOURS,
  type DayKey,
  type WeeklySchedule,
} from "@/lib/doctor-settings";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import {
  settingsSaveTargets,
  writeClinicSettings,
  type SettingsClinicInput,
} from "@/lib/professional-clinic-settings-writes";
import {
  isSpecialtyChangeAttempt,
  SPECIALTY_CHANGE_REQUIRES_SUPPORT_MESSAGE,
} from "@/lib/doctor-specialty-settings-lock";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { loadPrimarySpecialtyName } from "@/lib/specialty-catalogue";
import {
  SETTINGS_MOBILE_IN_USE_MESSAGE,
  professionalContactUniqueViolation,
} from "@/lib/professional-contact";

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
    .from("professionals")
    .select("id")
    .eq("id", doctorId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (ownErr || !owned) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("professional_settings")
    .select("*")
    .eq("professional_id", doctorId)
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

/** POST - upsert professional_settings + update the mobile, bio, languages (owner only).
 * Clinics are read-only here (user, 2026-09-29 phones; 2026-09-30 D4 addresses): they are
 * curated by DocCy, so a save writes each clinic's hours and name on the professional's
 * join row and never an address. Address fields an old page still sends are ignored.
 * Specialty is locked after registration — changes go through Support. */
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
    locations?: SettingsClinicInput[];
  };

  if (!b.doctorId) {
    return NextResponse.json(
      { message: "Missing doctorId." },
      { status: 400 }
    );
  }

  const doctorId = b.doctorId;

  const { data: owned, error: ownErr } = await supabase
    .from("professionals")
    .select("id")
    .eq("id", doctorId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (ownErr || !owned) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const specialtyRaw =
    typeof b.specialty === "string" ? b.specialty.trim() : undefined;
  // Same label the settings page shows (professional_specialties, service role:
  // the table has no RLS policies for users).
  const specialtyService = specialtyRaw === undefined ? null : createServiceRoleClient();
  const currentSpecialty = specialtyService
    ? await loadPrimarySpecialtyName(specialtyService, doctorId)
    : null;
  if (specialtyRaw !== undefined && isSpecialtyChangeAttempt(currentSpecialty, specialtyRaw)) {
    return NextResponse.json(
      { message: SPECIALTY_CHANGE_REQUIRES_SUPPORT_MESSAGE },
      { status: 400 },
    );
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
  const doctorPhoneTrimmed =
    typeof b.doctorPhone === "string" ? b.doctorPhone.trim() : "";

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
    professional_id: doctorId,
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
    updated_at: new Date().toISOString(),
  };

  const legacyPayload = {
    professional_id: doctorId,
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
    .from("professional_settings")
    .upsert(payload, { onConflict: "professional_id" })
    .select()
    .single();

  let data = dataFull ?? null;
  if (errorFull) {
    // Missing new scheduling columns means advanced availability cannot be saved reliably.
    const errMsg = String((errorFull as any)?.message ?? "");
    const missingNewCols =
      /(saturday|sunday|weekly_schedule|pause_online_bookings|holiday_mode_enabled|holiday_start_date|holiday_end_date|booking_horizon_days|minimum_notice_hours)/i.test(
        errMsg
      );
    if ((errorFull as { code?: string }).code === "42703" || missingNewCols) {
      return NextResponse.json(
        {
          message:
            "Advanced schedule settings are unavailable because the database is missing columns. Please contact DocCy support.",
        },
        { status: 500 }
      );
    }

    if (!data && (errorFull as { code?: string }).code === "PGRST204") {
      const {
        data: dataLegacy,
        error: errorLegacy,
      } = await supabase
        .from("professional_settings")
        .upsert(legacyPayload, { onConflict: "professional_id" })
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
    mobile_number?: string | null;
    bio?: string | null;
    languages: string[];
  } = { languages };
  if (b.doctorPhone !== undefined) {
    phoneUpdateBase.mobile_number = doctorPhoneTrimmed ? doctorPhoneTrimmed : null;
  }
  if (b.bio !== undefined) {
    phoneUpdateBase.bio = bioRaw.length > 0 ? bioRaw : null;
  }

  let docErr = (
    await supabase.from("professionals").update(phoneUpdateBase).eq("id", doctorId)
  ).error;

  if (
    docErr &&
    (docErr.code === "42703" ||
      docErr.code === "PGRST204" ||
      String(docErr.message ?? "").toLowerCase().includes("column"))
  ) {
    if (/mobile_number/i.test(String(docErr.message ?? ""))) {
      const { mobile_number: _mobile, ...withoutMobile } = phoneUpdateBase;
      docErr = (
        await supabase.from("professionals").update(withoutMobile).eq("id", doctorId)
      ).error;
    }
  }

  if (professionalContactUniqueViolation(docErr) === "mobile") {
    return NextResponse.json({ message: SETTINGS_MOBILE_IN_USE_MESSAGE }, { status: 409 });
  }

  if (docErr) {
    console.error("[DocCy] Failed to update doctors row", docErr);
    return NextResponse.json(
      {
        message:
          docErr.message?.includes("languages") || docErr.code === "42703"
            ? "Languages could not be saved because the database is missing a column. Please contact DocCy support."
            : "Error updating professional profile.",
      },
      { status: 500 }
    );
  }

  const ownedClinics = await loadDoctorLocations(doctorId);
  const clinicInputs: SettingsClinicInput[] =
    locationsPayload.length > 0
      ? locationsPayload
      : [
          {
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

  for (const { locationId, settings } of settingsSaveTargets(clinicInputs, ownedClinics)) {
    const saved = await writeClinicSettings(doctorId, locationId, settings);
    if (!saved.ok) {
      console.error("[DocCy] Failed to save clinic settings", saved.error);
      return NextResponse.json(
        { message: "Error saving clinic settings." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ settings: data }, { status: 200 });
}
