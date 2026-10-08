"use client";

import { PATIENT_CANCEL_NOTICE_CHOICES, parsePatientCancelNoticeHours } from "@/lib/patient-cancel-window";
import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import { LanguageMultiSelect } from "@/components/languages/LanguageMultiSelect";
import {
  BOOKING_HORIZON_OPTIONS_DAYS,
  DEFAULT_BOOKING_HORIZON_DAYS,
  DAY_NAMES,
  DEFAULT_MIN_NOTICE_HOURS,
  MIN_NOTICE_OPTIONS_HOURS,
  type DayKey,
  type WeeklySchedule,
} from "@/lib/doctor-settings";
import {
  formatISOToDDMMYYYYOrEmpty,
  parseDDMMYYYYToISO,
} from "@/lib/date-format";
import { emitOpenFeedback } from "@/lib/doccy-feedback";
import { clinicChangeContactMessage } from "@/lib/professional-clinic-settings-writes";
import { specialtyChangeContactMessage } from "@/lib/doctor-specialties";
import { OnlineBookingsPauseToggle } from "@/components/dashboard/OnlineBookingsPauseToggle";
import {
  MAX_CLINIC_NAME_LENGTH,
  clinicDefaultName,
  clinicDisplayName,
  workplaceAccent,
} from "@/lib/doctor-locations";
import { clinicLocationFromParts, type ClinicLocation } from "@/lib/clinic-location";
import {
  buildSettingsDirtySnapshot,
  settingsFormHasUnsavedChanges,
  type SettingsDirtySnapshot,
} from "@/lib/settings-form-dirty";
import { useSettingsUnsavedChangesWarning } from "@/components/dashboard/useSettingsUnsavedChangesWarning";
import { isCatalogueSpecialty } from "@/lib/specialty-options";
import { PhoneNumbersSettings } from "@/components/dashboard/PhoneNumbersSettings";
import type { SettingsClinicPhone } from "@/lib/settings-clinic-phones";

export type DoctorSettingsFormData = {
  doctorId: string;
  doctorName: string;
  avatarUrl?: string | null;
  /** Shown in directory & public profile */
  specialty: string;
  /** Catalogue names offered in the specialty combobox (`loadSpecialtyCatalogueNames`). */
  specialtyOptions: string[];
  /** Approved specialty labels (flat). */
  specialties?: string[];
  /** false = custom “Other” text pending founder approval */
  /** Public profile “About” section */
  bio: string;
  /** Canonical labels, saved as string[] on doctors */
  languages: string[];
  mobileNumber?: string;
  /** The phones patients see, one per clinic; read-only here (clinics are curated). */
  clinicPhones?: SettingsClinicPhone[];
  district: string;
  clinicAddress: string;
  clinicTown?: string | null;
  clinicLatitude?: number | null;
  clinicLongitude?: number | null;
  clinicPlaceId?: string | null;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  weeklySchedule: WeeklySchedule;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
  slotDurationMinutes: number;
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  /** Until how many hours before the visit patients can cancel online (12 / 24 / 48). */
  patientCancelNoticeHours: number;
  holidayModeEnabled: boolean;
  holidayStartDate: string | null; // "YYYY-MM-DD"
  holidayEndDate: string | null; // "YYYY-MM-DD"
  pauseOnlineBookings: boolean;
  /** Pro access has ended: the pause toggle is off and disabled. */
  accessEnded?: boolean;
  services: DoctorServiceItem[];
  locations?: DoctorWorkplaceFormData[];
};

export type DoctorWorkplaceFormData = {
  id: string;
  isPrimary: boolean;
  label?: string | null;
  district: string;
  clinicAddress: string;
  clinicTown?: string | null;
  clinicLatitude?: number | null;
  clinicLongitude?: number | null;
  clinicPlaceId?: string | null;
  weeklySchedule: WeeklySchedule;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
  slotDurationMinutes: number;
  pauseOnlineBookings: boolean;
};

export type DoctorServiceItem = {
  id: string;
  name: string;
  price: string | null;
  created_at: string;
};

type SettingsFormProps = {
  initial: DoctorSettingsFormData;
};

type CropArea = { x: number; y: number; width: number; height: number };
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const BIO_MAX_CHARS = 1000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = src;
  });
}

async function cropToBlob(imageSrc: string, area: CropArea): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare crop canvas.");

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const toBlob = (quality: number) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/jpeg", quality);
    });

  const targetBytes = 280 * 1024;
  let quality = 0.9;
  let blob = await toBlob(quality);
  if (!blob) throw new Error("Could not generate cropped image.");

  while (blob.size > targetBytes && quality > 0.72) {
    quality -= 0.06;
    const nextBlob = await toBlob(quality);
    if (!nextBlob) break;
    blob = nextBlob;
  }

  return blob;
}

function timeToInputValue(t: string | null | undefined): string {
  if (!t) return "09:00";
  const parts = String(t).split(":");
  const h = parts[0]?.padStart(2, "0") ?? "09";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}`;
}

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const TIME_INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 [&::-webkit-calendar-picker-indicator]:contrast-125";

function initialWorkplacesFromForm(initial: DoctorSettingsFormData): DoctorWorkplaceFormData[] {
  if (initial.locations && initial.locations.length > 0) {
    return initial.locations;
  }
  return [
    {
      id: "primary",
      isPrimary: true,
      label: "",
      district: initial.district,
      clinicAddress: initial.clinicAddress,
      clinicTown: initial.clinicTown,
      clinicLatitude: initial.clinicLatitude,
      clinicLongitude: initial.clinicLongitude,
      clinicPlaceId: initial.clinicPlaceId,
      weeklySchedule: initial.weeklySchedule,
      breakEnabled: initial.breakEnabled,
      breakStart: initial.breakStart,
      breakEnd: initial.breakEnd,
      slotDurationMinutes: initial.slotDurationMinutes,
      pauseOnlineBookings: initial.pauseOnlineBookings,
    },
  ];
}

/** Prefer workplace row when professionals.clinic_address is empty (dual-store drift). */
function resolveInitialClinicLocation(initial: DoctorSettingsFormData): ClinicLocation {
  const workplaces = initialWorkplacesFromForm(initial);
  const primary = workplaces[0];
  const address =
    String(initial.clinicAddress ?? "").trim() ||
    String(primary?.clinicAddress ?? "").trim();
  return clinicLocationFromParts({
    address,
    latitude: initial.clinicLatitude ?? primary?.clinicLatitude ?? null,
    longitude: initial.clinicLongitude ?? primary?.clinicLongitude ?? null,
    placeId: initial.clinicPlaceId ?? primary?.clinicPlaceId ?? null,
    district: initial.district || primary?.district || "",
    town: initial.clinicTown ?? primary?.clinicTown ?? null,
  });
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const [isClient, setIsClient] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const lockedSpecialty = (initial.specialty ?? "").trim();
  const lockedSpecialties =
    Array.isArray(initial.specialties) && initial.specialties.length > 0
      ? initial.specialties.map((s) => s.trim()).filter(Boolean)
      : lockedSpecialty
        ? [lockedSpecialty]
        : [];
  const specialtyFromMaster = isCatalogueSpecialty(initial.specialtyOptions, lockedSpecialty);
  const [languages, setLanguages] = React.useState<string[]>(() =>
    Array.isArray(initial.languages) ? [...initial.languages] : []
  );
  const [bio, setBio] = React.useState(() => (initial.bio ?? "").trim());

  const [mobileNumber, setMobileNumber] = React.useState(
    initial.mobileNumber ?? ""
  );
  const [district, setDistrict] = React.useState(initial.district ?? "");
  const [clinicLocation, setClinicLocation] = React.useState<ClinicLocation>(() =>
    resolveInitialClinicLocation(initial),
  );

  const [weeklySchedule, setWeeklySchedule] = React.useState<WeeklySchedule>(
    initial.weeklySchedule
  );
  const [breakEnabled, setBreakEnabled] = React.useState(
    initial.breakEnabled
  );
  const [breakStart, setBreakStart] = React.useState(
    timeToInputValue(initial.breakStart)
  );
  const [breakEnd, setBreakEnd] = React.useState(
    timeToInputValue(initial.breakEnd)
  );
  const [slotDurationMinutes, setSlotDurationMinutes] = React.useState(
    initial.slotDurationMinutes
  );
  const [workplaces, setWorkplaces] = React.useState<DoctorWorkplaceFormData[]>(
    () => initialWorkplacesFromForm(initial),
  );
  const [activeWorkplaceId, setActiveWorkplaceId] = React.useState(
    () => initialWorkplacesFromForm(initial)[0]?.id ?? "primary",
  );
  const workplaceTabScrollYRef = React.useRef<number | null>(null);

  const [bookingHorizonDays, setBookingHorizonDays] = React.useState(
    initial.bookingHorizonDays
  );
  const [minimumNoticeHours, setMinimumNoticeHours] = React.useState(
    initial.minimumNoticeHours
  );
  const [patientCancelNoticeHours, setPatientCancelNoticeHours] = React.useState(
    initial.patientCancelNoticeHours
  );
  const [holidayModeEnabled, setHolidayModeEnabled] = React.useState(
    initial.holidayModeEnabled
  );
  const [holidayStartDate, setHolidayStartDate] = React.useState<
    string | null
  >(initial.holidayStartDate);
  const [holidayEndDate, setHolidayEndDate] = React.useState<string | null>(
    initial.holidayEndDate
  );
  const [holidayStartInput, setHolidayStartInput] = React.useState(
    formatISOToDDMMYYYYOrEmpty(initial.holidayStartDate)
  );
  const [holidayEndInput, setHolidayEndInput] = React.useState(
    formatISOToDDMMYYYYOrEmpty(initial.holidayEndDate)
  );
  const [services, setServices] = React.useState<DoctorServiceItem[]>(
    Array.isArray(initial.services) ? initial.services : []
  );
  const [serviceName, setServiceName] = React.useState("");
  const [servicePrice, setServicePrice] = React.useState("");
  const [serviceSubmitting, setServiceSubmitting] = React.useState(false);
  const [deletingServiceId, setDeletingServiceId] = React.useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const [avatarCropping, setAvatarCropping] = React.useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState<string | null>(
    initial.avatarUrl?.trim() ? initial.avatarUrl : null
  );
  const [avatarSourceUrl, setAvatarSourceUrl] = React.useState<string | null>(null);
  const [avatarCrop, setAvatarCrop] = React.useState({ x: 0, y: 0 });
  const [avatarZoom, setAvatarZoom] = React.useState(1);
  const [avatarCroppedPixels, setAvatarCroppedPixels] = React.useState<CropArea | null>(null);
  const [avatarCropOpen, setAvatarCropOpen] = React.useState(false);
  const avatarFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const captureActiveWorkplace = React.useCallback((): DoctorWorkplaceFormData => {
    const current = workplaces.find((row) => row.id === activeWorkplaceId);
    return {
      id: activeWorkplaceId,
      isPrimary: current?.isPrimary ?? workplaces.length <= 1,
      label: String(current?.label ?? "").trim(),
      district: clinicLocation.district ?? district,
      clinicAddress: clinicLocation.address,
      clinicTown: clinicLocation.town,
      clinicLatitude: clinicLocation.latitude,
      clinicLongitude: clinicLocation.longitude,
      clinicPlaceId: clinicLocation.placeId,
      weeklySchedule,
      breakEnabled,
      breakStart,
      breakEnd,
      slotDurationMinutes,
      pauseOnlineBookings: Boolean(current?.pauseOnlineBookings),
    };
  }, [
    activeWorkplaceId,
    breakEnabled,
    breakEnd,
    breakStart,
    clinicLocation,
    district,
    slotDurationMinutes,
    weeklySchedule,
    workplaces,
  ]);

  const applyWorkplaceToForm = React.useCallback((row: DoctorWorkplaceFormData) => {
    setActiveWorkplaceId(row.id);
    setDistrict(row.district);
    setClinicLocation(
      clinicLocationFromParts({
        address: row.clinicAddress,
        latitude: row.clinicLatitude,
        longitude: row.clinicLongitude,
        placeId: row.clinicPlaceId,
        district: row.district,
        town: row.clinicTown,
      }),
    );
    setWeeklySchedule(row.weeklySchedule);
    setBreakEnabled(row.breakEnabled);
    setBreakStart(timeToInputValue(row.breakStart));
    setBreakEnd(timeToInputValue(row.breakEnd));
    setSlotDurationMinutes(row.slotDurationMinutes);
  }, []);

  const workplacesForSave = React.useCallback(() => {
    const captured = captureActiveWorkplace();
    return workplaces.map((row) => (row.id === captured.id ? captured : row));
  }, [captureActiveWorkplace, workplaces]);

  function handleSelectWorkplace(id: string) {
    if (id === activeWorkplaceId) return;
    workplaceTabScrollYRef.current = window.scrollY;
    const captured = captureActiveWorkplace();
    const nextList = workplaces.map((row) => (row.id === captured.id ? captured : row));
    setWorkplaces(nextList);
    const next = nextList.find((row) => row.id === id);
    if (next) applyWorkplaceToForm(next);
  }

  React.useLayoutEffect(() => {
    const y = workplaceTabScrollYRef.current;
    if (y == null) return;
    window.scrollTo({ top: y, left: 0, behavior: "auto" });
    workplaceTabScrollYRef.current = null;
  }, [activeWorkplaceId]);

  const buildCurrentDirtySnapshot = React.useCallback(
    (): SettingsDirtySnapshot =>
      buildSettingsDirtySnapshot({
        specialty: lockedSpecialty,
        specialtyFromMaster,
        bio,
        languages,
        mobileNumber,
        bookingHorizonDays,
        minimumNoticeHours,
        patientCancelNoticeHours,
        holidayModeEnabled,
        holidayStartInput,
        holidayEndInput,
        workplaces: workplacesForSave().map((row) => ({
          id: row.id,
          label: String(row.label ?? "").trim(),
          district: row.district,
          clinicAddress: row.clinicAddress,
          clinicLatitude: row.clinicLatitude ?? null,
          clinicLongitude: row.clinicLongitude ?? null,
          clinicPlaceId: row.clinicPlaceId ?? null,
          weeklySchedule: row.weeklySchedule,
          breakEnabled: row.breakEnabled,
          breakStart: row.breakStart,
          breakEnd: row.breakEnd,
          slotDurationMinutes: row.slotDurationMinutes,
        })),
      }),
    [
      lockedSpecialty,
      specialtyFromMaster,
      bio,
      languages,
      mobileNumber,
      bookingHorizonDays,
      minimumNoticeHours,
      patientCancelNoticeHours,
      holidayModeEnabled,
      holidayStartInput,
      holidayEndInput,
      workplacesForSave,
    ],
  );

  const [savedSnapshot, setSavedSnapshot] = React.useState<SettingsDirtySnapshot>(() => {
    const specialty = (initial.specialty ?? "").trim();
    return buildSettingsDirtySnapshot({
      specialty,
      specialtyFromMaster: isCatalogueSpecialty(initial.specialtyOptions, specialty),
      bio: (initial.bio ?? "").trim(),
      languages: Array.isArray(initial.languages) ? [...initial.languages] : [],
      mobileNumber: initial.mobileNumber ?? "",
      bookingHorizonDays: initial.bookingHorizonDays,
      minimumNoticeHours: initial.minimumNoticeHours,
      patientCancelNoticeHours: initial.patientCancelNoticeHours,
      holidayModeEnabled: initial.holidayModeEnabled,
      holidayStartInput: formatISOToDDMMYYYYOrEmpty(initial.holidayStartDate),
      holidayEndInput: formatISOToDDMMYYYYOrEmpty(initial.holidayEndDate),
      workplaces: initialWorkplacesFromForm(initial).map((row) => ({
        id: row.id,
        label: String(row.label ?? "").trim(),
        district: row.district,
        clinicAddress: row.clinicAddress,
        clinicLatitude: row.clinicLatitude ?? null,
        clinicLongitude: row.clinicLongitude ?? null,
        clinicPlaceId: row.clinicPlaceId ?? null,
        weeklySchedule: row.weeklySchedule,
        breakEnabled: row.breakEnabled,
        breakStart: row.breakStart,
        breakEnd: row.breakEnd,
        slotDurationMinutes: row.slotDurationMinutes,
      })),
    });
  });

  const hasUnsavedChanges = React.useMemo(
    () => settingsFormHasUnsavedChanges(buildCurrentDirtySnapshot(), savedSnapshot),
    [buildCurrentDirtySnapshot, savedSnapshot],
  );

  useSettingsUnsavedChangesWarning(hasUnsavedChanges);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    return () => {
      if (avatarSourceUrl) URL.revokeObjectURL(avatarSourceUrl);
    };
  }, [avatarSourceUrl]);

  React.useEffect(() => {
    if (!avatarCropOpen) return;
    document.body.classList.add("overflow-hidden");
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [avatarCropOpen]);

  function closeAvatarCropModal() {
    setAvatarCropOpen(false);
    if (avatarSourceUrl) {
      URL.revokeObjectURL(avatarSourceUrl);
      setAvatarSourceUrl(null);
    }
  }

  function onPickAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type.toLowerCase())) {
      toast.error("Use JPG, PNG, WEBP, or GIF.");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image is too large. Max 10 MB.");
      return;
    }

    if (avatarSourceUrl) URL.revokeObjectURL(avatarSourceUrl);
    const sourceUrl = URL.createObjectURL(file);
    setAvatarSourceUrl(sourceUrl);
    setAvatarCrop({ x: 0, y: 0 });
    setAvatarZoom(1);
    setAvatarCroppedPixels(null);
    setAvatarCropOpen(true);
    e.target.value = "";
  }

  async function uploadAvatarBlob(blob: Blob) {
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.set("doctorId", initial.doctorId);
      form.set(
        "avatarFile",
        new File([blob], "profile-photo.jpg", { type: "image/jpeg" })
      );
      const res = await fetch("/api/doctor-avatar", { method: "POST", body: form });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((payload.message as string) || "Could not upload photo.");
        return;
      }
      const nextUrl = String(payload.publicUrl ?? "").trim();
      if (nextUrl) setAvatarPreviewUrl(nextUrl);
      toast.success("Profile photo updated.");
    } catch (err) {
      console.error(err);
      toast.error("Could not upload photo.");
    } finally {
      setAvatarUploading(false);
      setAvatarCropOpen(false);
      if (avatarSourceUrl) {
        URL.revokeObjectURL(avatarSourceUrl);
        setAvatarSourceUrl(null);
      }
    }
  }

  async function onConfirmAvatarCrop() {
    if (!avatarSourceUrl || !avatarCroppedPixels) {
      toast.error("Please adjust and confirm your crop.");
      return;
    }
    setAvatarCropping(true);
    try {
      const blob = await cropToBlob(avatarSourceUrl, avatarCroppedPixels);
      await uploadAvatarBlob(blob);
    } catch (err) {
      console.error(err);
      toast.error("Could not process photo.");
      closeAvatarCropModal();
    } finally {
      setAvatarCropping(false);
    }
  }

  async function handleAddService() {
    const name = serviceName.trim();
    const price = servicePrice.trim();
    if (!name) {
      toast.error("Service name is required.");
      return;
    }
    setServiceSubmitting(true);
    try {
      const addOnce = async () => {
        const res = await fetch("/api/doctor-services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doctorId: initial.doctorId,
            name,
            price: price || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        return { res, data };
      };

      let { res, data } = await addOnce();
      // Occasionally the first request can race with auth/session propagation.
      if (!res.ok && [401, 403, 500].includes(res.status)) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const retry = await addOnce();
        res = retry.res;
        data = retry.data;
      }

      if (!res.ok) {
        toast.error((data.message as string) || "Could not add service.");
        return;
      }

      const newService = data.service as DoctorServiceItem | undefined;
      if (newService) setServices((prev) => [...prev, newService]);
      setServiceName("");
      setServicePrice("");
      toast.success("Service added.");
    } catch (err) {
      console.error(err);
      toast.error("Could not add service.");
    } finally {
      setServiceSubmitting(false);
    }
  }

  async function handleDeleteService(serviceId: string) {
    setDeletingServiceId(serviceId);
    try {
      const res = await fetch("/api/doctor-services", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: initial.doctorId,
          serviceId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data.message as string) || "Could not delete service.");
        return;
      }
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      toast.success("Service removed.");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete service.");
    } finally {
      setDeletingServiceId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const langList = languages.filter((s) => s.trim().length > 0);
    if (langList.length === 0) {
      const text = "Add at least one language (e.g. English, Greek).";
      setMessage({ type: "error", text });
      toast.error(text);
      return;
    }
    const bioTrimmed = bio.trim();
    if (bioTrimmed.length > BIO_MAX_CHARS) {
      const text = `Bio must be ${BIO_MAX_CHARS} characters or fewer.`;
      setMessage({ type: "error", text });
      toast.error(text);
      return;
    }
    const parsedHolidayStart = holidayModeEnabled
      ? parseDDMMYYYYToISO(holidayStartInput)
      : null;
    const parsedHolidayEnd = holidayModeEnabled
      ? parseDDMMYYYYToISO(holidayEndInput)
      : null;

    if (holidayModeEnabled) {
      if (!parsedHolidayStart || !parsedHolidayEnd) {
        const text = "Use DD/MM/YYYY for Holiday start and end.";
        setMessage({ type: "error", text });
        toast.error(text);
        return;
      }
      if (parsedHolidayStart > parsedHolidayEnd) {
        const text =
          "Holiday start date must be before (or equal to) end date.";
        setMessage({ type: "error", text });
        toast.error(text);
        return;
      }
    }

    setSaving(true);
    try {
      const savePayload: Record<string, unknown> = {
        doctorId: initial.doctorId,
        doctorPhone: mobileNumber || null,
        bio: bioTrimmed,
        languages: langList,
        monday: weeklySchedule.monday.enabled,
        tuesday: weeklySchedule.tuesday.enabled,
        wednesday: weeklySchedule.wednesday.enabled,
        thursday: weeklySchedule.thursday.enabled,
        friday: weeklySchedule.friday.enabled,
        saturday: weeklySchedule.saturday.enabled,
        sunday: weeklySchedule.sunday.enabled,
        weeklySchedule,
        breakEnabled,
        breakStart,
        breakEnd,
        slotDurationMinutes,
        bookingHorizonDays,
        minimumNoticeHours,
        patientCancelNoticeHours,
        holidayModeEnabled,
        holidayStartDate: parsedHolidayStart,
        holidayEndDate: parsedHolidayEnd,
        locations: workplacesForSave().map((row) => ({
          id: row.id.startsWith("primary") && row.id === "primary" ? undefined : row.id,
          label: String(row.label ?? "").trim(),
          weeklySchedule: row.weeklySchedule,
          monday: row.weeklySchedule.monday.enabled,
          tuesday: row.weeklySchedule.tuesday.enabled,
          wednesday: row.weeklySchedule.wednesday.enabled,
          thursday: row.weeklySchedule.thursday.enabled,
          friday: row.weeklySchedule.friday.enabled,
          saturday: row.weeklySchedule.saturday.enabled,
          sunday: row.weeklySchedule.sunday.enabled,
          breakEnabled: row.breakEnabled,
          breakStart: row.breakStart,
          breakEnd: row.breakEnd,
          slotDurationMinutes: row.slotDurationMinutes,
        })),
      };

      const res = await fetch("/api/doctor-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savePayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const text = (data.message as string) || "Failed to save settings.";
        setMessage({
          type: "error",
          text,
        });
        toast.error(text);
        return;
      }
      if (holidayModeEnabled) {
        setHolidayStartDate(parsedHolidayStart);
        setHolidayEndDate(parsedHolidayEnd);
      }
      setSavedSnapshot(buildCurrentDirtySnapshot());
      setMessage({ type: "success", text: "Settings saved." });
      toast.success("Settings saved.");
    } catch (err) {
      console.error(err);
      const text = "Something went wrong.";
      setMessage({ type: "error", text });
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  const days = DAY_NAMES.map((key) => ({
    key,
    label: DAY_LABELS[key],
    value: weeklySchedule[key].enabled,
  }));
  const activeWorkplaceIndex = Math.max(
    0,
    workplaces.findIndex((row) => row.id === activeWorkplaceId),
  );
  const accent = workplaceAccent(activeWorkplaceIndex);
  const activeWorkplaceLabel = clinicDisplayName(
    workplaces[activeWorkplaceIndex]?.label,
    activeWorkplaceIndex,
    workplaces.length,
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasUnsavedChanges ? (
        <div
          role="status"
          data-testid="settings-unsaved-changes"
          className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          You have unsaved changes. Save settings before leaving this page.
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Directory &amp; profile
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Languages help patients find you. Your bio helps DocCy match you with
          the right ones.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Specialties
            </p>
            <div
              data-testid="settings-specialty-locked"
              className="mt-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5"
            >
              {lockedSpecialties.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {lockedSpecialties.map((label) => (
                    <li
                      key={label}
                      className="rounded-full border border-slate-600 bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-slate-100"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-medium text-slate-100">Not set</p>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Specialties are verified with your registration.{" "}
              <button
                type="button"
                data-testid="settings-specialties-contact"
                onClick={() =>
                  emitOpenFeedback({
                    subject: "General Question",
                    message: specialtyChangeContactMessage(lockedSpecialties),
                  })
                }
                className="font-medium text-clinical-300 underline-offset-2 hover:text-clinical-200 hover:underline"
              >
                Contact us if you wish to change your specialties
              </button>
              .
            </p>
          </div>
          <div>
            <label
              htmlFor="settings-bio"
              className="text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              How you help patients
            </label>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Write what you treat and how you help. DocCy uses this to match you
              with the right patients.
            </p>
            <textarea
              id="settings-bio"
              name="bio"
              rows={5}
              value={bio}
              maxLength={BIO_MAX_CHARS}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Example: I treat back pain, sports injuries, and post-surgery rehab."
              className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-clinical-400/60 focus:ring-2 focus:ring-clinical-400/30"
            />
            <p className="mt-1.5 text-right text-[11px] tabular-nums text-slate-500">
              {bio.trim().length}/{BIO_MAX_CHARS}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Languages <span className="text-red-300">*</span>
            </p>
            <LanguageMultiSelect
              id="settings-languages"
              selected={languages}
              onSelectedChange={setLanguages}
              variant="settings"
            />
          </div>
        </div>
      </div>

      <div>
        {workplaces.length > 1 ? (
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div
              className="flex min-w-0 flex-1 flex-wrap items-end gap-1 px-1"
              role="tablist"
              aria-label="Clinics"
            >
              {workplaces.map((row, index) => {
                const selected = row.id === activeWorkplaceId;
                const tabAccent = workplaceAccent(index);
                const tabLabel = clinicDisplayName(row.label, index, workplaces.length);
                return (
                  <button
                    key={row.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    title={tabLabel}
                    onClick={() => handleSelectWorkplace(row.id)}
                    className={`max-w-[11rem] truncate shrink-0 transition ${
                      selected ? tabAccent.tabSelected : tabAccent.tabIdle
                    }`}
                  >
                    {tabLabel}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div
          data-testid="workplace-settings-frame"
          className={`rounded-2xl border-2 p-5 transition-colors [overflow-anchor:none] ${accent.frame} ${
            workplaces.length > 1 ? "rounded-tl-lg" : ""
          }`}
        >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Clinics
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {workplaces.length > 1
              ? "Each tab is a different clinic. Hours and online booking belong only to the selected one."
              : "Your hours and online booking switch for this clinic."}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent.tint}`} aria-hidden />
          <p className={`text-sm font-semibold ${accent.title}`}>
            {activeWorkplaceLabel} settings
          </p>
        </div>

        <div className="mt-4">
          <label
            htmlFor="clinicName"
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
          >
            Clinic name
          </label>
          <input
            id="clinicName"
            type="text"
            maxLength={MAX_CLINIC_NAME_LENGTH}
            value={workplaces.find((row) => row.id === activeWorkplaceId)?.label ?? ""}
            onChange={(e) => {
              const next = e.target.value.slice(0, MAX_CLINIC_NAME_LENGTH);
              setWorkplaces((prev) =>
                prev.map((row) =>
                  row.id === activeWorkplaceId ? { ...row, label: next } : row,
                ),
              );
            }}
            placeholder={clinicDefaultName(activeWorkplaceIndex, workplaces.length)}
            className="mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
          />
          <p className="mt-2 text-xs text-slate-400">
            Patients see this name when they book. Leave blank to use Clinic 1, Clinic 2, and so on.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <OnlineBookingsPauseToggle
            key={activeWorkplaceId}
            initialPaused={Boolean(
              workplaces.find((row) => row.id === activeWorkplaceId)?.pauseOnlineBookings,
            )}
            locationId={activeWorkplaceId === "primary" ? null : activeWorkplaceId}
            accessEnded={Boolean(initial.accessEnded)}
            onPausedChange={(paused) => {
              setWorkplaces((prev) =>
                prev.map((row) =>
                  row.id === activeWorkplaceId
                    ? { ...row, pauseOnlineBookings: paused }
                    : row,
                ),
              );
            }}
          />
        </div>

        <div className="mt-5 rounded-xl border border-slate-800/70 bg-ink-900/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Clinic address
          </p>
          <p data-testid="settings-clinic-address" className="mt-2 text-sm text-slate-100">
            {clinicLocation.address.trim() || "No address yet."}
          </p>
          <p className="mt-3 text-xs text-slate-400">
            DocCy keeps clinic details up to date.{" "}
            <button
              type="button"
              data-testid="settings-clinics-contact"
              onClick={() =>
                emitOpenFeedback({
                  subject: "General Question",
                  message: clinicChangeContactMessage(
                    (initial.clinicPhones ?? []).map((clinic) => clinic.name),
                  ),
                })
              }
              className="font-medium text-clinical-300 underline-offset-2 hover:text-clinical-200 hover:underline"
            >
              Contact us to change your clinics
            </button>
            .
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-slate-800/70 bg-ink-900/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Working days
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {workplaces.length > 1
              ? `Hours for ${activeWorkplaceLabel}. Other clinics keep their own schedule.`
              : "Select the days you see patients."}
          </p>
          <div className="mt-4 space-y-3">
            {days.map(({ key, label, value }) => (
              <div
                key={key}
                className="rounded-xl border border-slate-800/70 bg-ink-900/30 p-3"
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) =>
                      setWeeklySchedule((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], enabled: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-clinical-500 focus:ring-clinical-400/60"
                  />
                  <span className="text-sm text-slate-200">{label}</span>
                </label>

                {value && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`${key}-start`}
                        className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                      >
                        Start time
                      </label>
                      <input
                        id={`${key}-start`}
                        type="time"
                        value={timeToInputValue(weeklySchedule[key].start_time)}
                        onChange={(e) =>
                          setWeeklySchedule((prev) => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              start_time: `${e.target.value}:00`,
                            },
                          }))
                        }
                        className={TIME_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`${key}-end`}
                        className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                      >
                        End time
                      </label>
                      <input
                        id={`${key}-end`}
                        type="time"
                        value={timeToInputValue(weeklySchedule[key].end_time)}
                        onChange={(e) =>
                          setWeeklySchedule((prev) => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              end_time: `${e.target.value}:00`,
                            },
                          }))
                        }
                        className={TIME_INPUT_CLASS}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-800/70 bg-ink-900/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Daily break (optional)
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Patients will not be able to book this clinic during this time.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={breakEnabled}
                onChange={(e) => setBreakEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-clinical-500 focus:ring-clinical-400/60"
              />
              <span>Add a daily break</span>
            </label>
          </div>
          {breakEnabled && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="breakStart"
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  Break start
                </label>
                <input
                  id="breakStart"
                  type="time"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                  className={TIME_INPUT_CLASS}
                />
              </div>
              <div>
                <label
                  htmlFor="breakEnd"
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  Break end
                </label>
                <input
                  id="breakEnd"
                  type="time"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                  className={TIME_INPUT_CLASS}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-slate-800/70 bg-ink-900/35 p-4">
          <label
            htmlFor="slotDuration"
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Appointment slot duration (minutes)
          </label>
          <p className="mt-1 text-sm text-slate-300">
            {workplaces.length > 1
              ? `Slot length for ${activeWorkplaceLabel}.`
              : "e.g. 30 for 30-minute slots."}
          </p>
          <select
            id="slotDuration"
            value={slotDurationMinutes}
            onChange={(e) =>
              setSlotDurationMinutes(Number(e.target.value))
            }
            className="mt-3 w-full max-w-xs rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
          >
            {[15, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n} min
              </option>
            ))}
          </select>
        </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Profile photo
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Keep your public profile photo up to date for better trust.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-700 bg-ink-900/70">
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt="Profile preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                No photo
              </div>
            )}
          </div>
          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            data-testid="settings-avatar-file-input"
            className="hidden"
            onChange={onPickAvatarFile}
            disabled={avatarUploading}
          />
          <button
            type="button"
            onClick={() => avatarFileInputRef.current?.click()}
            disabled={avatarUploading}
            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-clinical-400/35 bg-clinical-500/10 px-3 py-2 text-xs font-medium text-clinical-200 transition hover:bg-clinical-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {avatarUploading ? "Uploading..." : "Upload new photo"}
          </button>
        </div>
      </div>
      {isClient && avatarCropOpen && avatarSourceUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-ink-900/75 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Crop profile photo"
            >
              <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
                <p className="mb-2 text-sm font-semibold text-slate-100">
                  Crop profile photo (1:1)
                </p>
                <div className="relative h-72 overflow-hidden rounded-xl bg-ink-900">
                  <Cropper
                    image={avatarSourceUrl}
                    crop={avatarCrop}
                    zoom={avatarZoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setAvatarCrop}
                    onZoomChange={setAvatarZoom}
                    onCropComplete={(_, croppedPixels) => {
                      setAvatarCroppedPixels(croppedPixels as CropArea);
                    }}
                  />
                </div>
                <div className="mt-3">
                  <label className="text-xs text-slate-300">
                    Zoom
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.05}
                      value={avatarZoom}
                      onChange={(e) => setAvatarZoom(Number(e.target.value))}
                      className="mt-2 w-full"
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAvatarCropModal}
                    className="rounded-xl border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirmAvatarCrop}
                    disabled={avatarUploading || avatarCropping}
                    className="rounded-xl bg-clinical-400 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60"
                  >
                    {avatarCropping
                      ? "Processing..."
                      : avatarUploading
                        ? "Uploading..."
                        : "Confirm crop"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <PhoneNumbersSettings
        mobileNumber={mobileNumber}
        onMobileNumberChange={setMobileNumber}
        clinicPhones={initial.clinicPhones ?? []}
      />

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Services
        </p>
        <p className="mt-1 text-sm text-slate-400">
          List treatments for your public profile. Prices are in{" "}
          <span className="font-medium text-slate-300">euros (EUR, €)</span>.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="Treatment name (e.g. Facial laser)"
            className="w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
          />
          <input
            type="text"
            value={servicePrice}
            onChange={(e) => setServicePrice(e.target.value)}
            placeholder="e.g. 120 or From 80"
            className="w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
          />
          <button
            type="button"
            onClick={handleAddService}
            disabled={serviceSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-clinical-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-clinical-400 disabled:opacity-60"
          >
            {serviceSubmitting ? "Adding..." : "Add"}
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {services.map((service) => (
            <li
              key={service.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-ink-900/35 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">{service.name}</p>
                {service.price ? (
                  <p className="text-xs text-slate-400">{service.price}</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={deletingServiceId === service.id}
                onClick={() => handleDeleteService(service.id)}
                aria-label={`Delete ${service.name}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 transition hover:border-red-400/70 hover:text-red-300 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Scheduling Boundaries
        </p>
        <p className="mt-1 text-sm text-slate-400">
          These apply to every clinic.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="bookingHorizonDays"
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              Future booking limit
            </label>
            <select
              id="bookingHorizonDays"
              value={bookingHorizonDays}
              onChange={(e) => {
                const next = Number(e.target.value);
                setBookingHorizonDays(
                  BOOKING_HORIZON_OPTIONS_DAYS.includes(
                    next as (typeof BOOKING_HORIZON_OPTIONS_DAYS)[number]
                  )
                    ? next
                    : DEFAULT_BOOKING_HORIZON_DAYS
                );
              }}
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
            >
              <option value={14}>2 weeks</option>
              <option value={30}>1 month</option>
              <option value={90}>3 months</option>
              <option value={180}>6 months</option>
            </select>
            <p className="mt-2 text-xs text-slate-400">
              How far in advance patients can book.
            </p>
          </div>
          <div>
            <label
              htmlFor="minimumNoticeHours"
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              Minimum notice period
            </label>
            <select
              id="minimumNoticeHours"
              value={minimumNoticeHours}
              onChange={(e) => {
                const next = Number(e.target.value);
                setMinimumNoticeHours(
                  MIN_NOTICE_OPTIONS_HOURS.includes(
                    next as (typeof MIN_NOTICE_OPTIONS_HOURS)[number]
                  )
                    ? next
                    : DEFAULT_MIN_NOTICE_HOURS
                );
              }}
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
            >
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={4}>4 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours (1 day)</option>
              <option value={48}>2 days</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
            <p className="mt-2 text-xs text-slate-400">
              Prevent last-minute surprises. Slots will be hidden if they are too close to the current time.
            </p>
          </div>
          <div>
            <label
              htmlFor="patientCancelNoticeHours"
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              Online cancellation deadline
            </label>
            <select
              id="patientCancelNoticeHours"
              value={patientCancelNoticeHours}
              onChange={(e) => setPatientCancelNoticeHours(parsePatientCancelNoticeHours(e.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
            >
              {PATIENT_CANCEL_NOTICE_CHOICES.map((hours) => (
                <option key={hours} value={hours}>
                  Up to {hours} hours before the visit
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-400">
              Until then, patients can cancel from their confirmation and reminder emails. After it, they see
              your clinic&apos;s phone instead.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Holiday Mode
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Completely block bookings during a date range, at every clinic.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={holidayModeEnabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setHolidayModeEnabled(enabled);
                if (!enabled) {
                  setHolidayStartDate(null);
                  setHolidayEndDate(null);
                  setHolidayStartInput("");
                  setHolidayEndInput("");
                }
              }}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-clinical-500 focus:ring-clinical-400/60"
            />
            <span>Enable</span>
          </label>
        </div>

        {holidayModeEnabled && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="holidayStart"
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              >
                Holiday start
              </label>
              <input
                id="holidayStart"
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                value={holidayStartInput}
                onChange={(e) => {
                  setHolidayStartInput(e.target.value);
                  const parsed = parseDDMMYYYYToISO(e.target.value);
                  setHolidayStartDate(parsed);
                }}
                className="mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
              />
            </div>
            <div>
              <label
                htmlFor="holidayEnd"
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              >
                Holiday end
              </label>
              <input
                id="holidayEnd"
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                value={holidayEndInput}
                onChange={(e) => {
                  setHolidayEndInput(e.target.value);
                  const parsed = parseDDMMYYYYToISO(e.target.value);
                  setHolidayEndDate(parsed);
                }}
                className="mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
              />
            </div>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-clinical-400/20 bg-clinical-400/10 text-clinical-200"
              : "border-red-500/20 bg-red-500/10 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className={`inline-flex items-center justify-center rounded-2xl bg-clinical-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/30 transition hover:bg-clinical-300 disabled:opacity-60 ${
            hasUnsavedChanges ? "ring-2 ring-amber-300/70 ring-offset-2 ring-offset-slate-950" : ""
          }`}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}
