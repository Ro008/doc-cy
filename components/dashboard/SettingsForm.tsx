"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Clock, Lock, Save, Trash2, X } from "lucide-react";
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
import {
  MAX_DOCTOR_LOCATIONS,
  clinicDefaultName,
  clinicDisplayName,
  workplaceAccent,
} from "@/lib/doctor-locations";
import {
  clinicLocationFromParts,
  type ClinicLocation,
} from "@/lib/clinic-location";
import {
  buildSettingsDirtySnapshot,
  settingsFormHasUnsavedChanges,
  unsavedSettingsSections,
  type SettingsDirtySnapshot,
} from "@/lib/settings-form-dirty";
import { useSettingsUnsavedChangesWarning } from "@/components/dashboard/useSettingsUnsavedChangesWarning";
import { SpecialtyCombobox } from "@/components/specialties/SpecialtyCombobox";
import { isCatalogueSpecialty } from "@/lib/specialty-options";
import { PUBLIC_SPECIALTY_UNDER_REVIEW_LABEL } from "@/lib/doctor-specialty-public";
import { type SpecialtyChangeRequestKind } from "@/lib/doctor-specialty-change-request";
import {
  SPECIALTY_LICENSE_HELP,
  pendingSpecialtyChip,
  validateAddSpecialtyRequest,
  type AddSpecialtyErrors,
} from "@/lib/settings-specialty-request";
import { PhoneNumbersSettings } from "@/components/dashboard/PhoneNumbersSettings";
import type { SettingsClinicPhone } from "@/lib/settings-clinic-phones";
import {
  SETTINGS_SECTIONS,
  parseSettingsSection,
  settingsSectionHref,
  type SettingsSectionId,
} from "@/lib/settings-sections";
import {
  LAST_SPECIALTY_MESSAGE,
  canRemoveClinic,
  canRemoveSpecialty,
  clinicsAfterRemoval,
} from "@/lib/settings-removal-rules";
import { AddClinicDialog, type NewClinic } from "@/components/dashboard/settings/AddClinicDialog";
import { settingsActionErrorMessage } from "@/lib/settings-backend-pending";
import {
  clinicBookingStatus,
  summarizeClinicBreak,
  summarizeClinicDays,
  summarizeClinicHours,
} from "@/lib/settings-clinic-summary";
import { agendaClinicEventColor } from "@/lib/doctor-locations";
import { SettingsSidebar } from "@/components/dashboard/settings/SettingsSidebar";
import { SettingsSwitch } from "@/components/dashboard/settings/SettingsSwitch";
import { ClinicBookingSwitch } from "@/components/dashboard/settings/ClinicBookingSwitch";
import { ClinicCard } from "@/components/dashboard/settings/ClinicCard";
import {
  ClinicChangeRequestDialog,
  type PendingClinicChange,
} from "@/components/dashboard/settings/ClinicChangeRequestDialog";
import {
  SettingsDialog,
  dialogDangerButtonClass,
  dialogSecondaryButtonClass,
} from "@/components/dashboard/settings/SettingsDialog";

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
  isSpecialtyApproved?: boolean;
  /** Pending specialty change request (settings lock queue). */
  pendingSpecialtyChange?: {
    requestKind: SpecialtyChangeRequestKind;
    fromSpecialty: string | null;
    toSpecialty: string | null;
    licenseNumber: string | null;
    createdAt: string;
  } | null;
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
  holidayModeEnabled: boolean;
  holidayStartDate: string | null; // "YYYY-MM-DD"
  holidayEndDate: string | null; // "YYYY-MM-DD"
  pauseOnlineBookings: boolean;
  services: DoctorServiceItem[];
  locations?: DoctorWorkplaceFormData[];
  /**
   * Clinic change requests waiting for DocCy, by location id. Loaded by the backend
   * once GET support exists (docs/handoff/settings-redesign.md); empty until then.
   */
  pendingClinicChanges?: Record<string, PendingClinicChange>;
  /** Clinics asked for and not yet approved by DocCy (same contract; empty until loaded). */
  pendingClinicAdds?: PendingClinicAdd[];
};

export type PendingClinicAdd = { clinic: NewClinic; createdAt: string };

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
  /** Section from `?section=`; the sidebar switches it on the client. */
  section?: SettingsSectionId;
  /** Name and badges at the top of the sidebar. */
  sidebarHeader?: React.ReactNode;
  /** Extra Profile rows rendered by the page (e.g. the GESY switch). */
  profileExtra?: React.ReactNode;
  /** The Account section: sign-out, promote your practice. */
  account?: React.ReactNode;
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

function cyprusTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia" }).format(new Date());
}

const SECTION_CARD_CLASS =
  "rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-xl shadow-black/20 sm:p-6";
const SECTION_EYEBROW_CLASS = "text-xs font-semibold uppercase tracking-[0.14em] text-slate-500";

export function SettingsForm({
  initial,
  section: initialSection,
  sidebarHeader,
  profileExtra,
  account,
}: SettingsFormProps) {
  const [section, setSection] = React.useState<SettingsSectionId>(
    () => initialSection ?? parseSettingsSection(null),
  );
  const selectSection = React.useCallback((next: SettingsSectionId) => {
    setSection(next);
    window.history.pushState(null, "", settingsSectionHref(next));
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);
  React.useEffect(() => {
    const onPop = () =>
      setSection(parseSettingsSection(new URLSearchParams(window.location.search).get("section")));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [isClient, setIsClient] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const lockedSpecialty = (initial.specialty ?? "").trim();
  const [lockedSpecialties, setLockedSpecialties] = React.useState<string[]>(() =>
    Array.isArray(initial.specialties) && initial.specialties.length > 0
      ? initial.specialties.map((s) => s.trim()).filter(Boolean)
      : lockedSpecialty
        ? [lockedSpecialty]
        : [],
  );
  const [specialtyToRemove, setSpecialtyToRemove] = React.useState<string | null>(null);
  const [specialtyRemoving, setSpecialtyRemoving] = React.useState(false);

  /** Removing a specialty is instant (contract: DELETE /api/doctor-specialties). */
  async function handleRemoveSpecialty(label: string): Promise<boolean> {
    const check = canRemoveSpecialty(lockedSpecialties, label);
    if (check.ok === false) {
      toast.error(check.message);
      return false;
    }
    setSpecialtyRemoving(true);
    try {
      // EXPECTED TO FAIL until Livio builds DELETE /api/doctor-specialties (backend pending, see
      // lib/settings-backend-pending.ts): the doctor sees a message saying so.
      const res = await fetch("/api/doctor-specialties", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialty: check.specialty }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(settingsActionErrorMessage("removeSpecialty", res.status, data, "Could not remove the specialty."));
        return false;
      }
      const next = Array.isArray(data?.specialties)
        ? (data.specialties as unknown[]).map((s) => String(s).trim()).filter(Boolean)
        : lockedSpecialties.filter((s) => s !== check.specialty);
      setLockedSpecialties(next);
      toast.success(`${check.specialty} removed from your profile.`);
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Could not remove the specialty.");
      return false;
    } finally {
      setSpecialtyRemoving(false);
    }
  }
  const specialtyFromMaster =
    (initial.isSpecialtyApproved ?? true) !== false &&
    isCatalogueSpecialty(initial.specialtyOptions, lockedSpecialty);
  const specialtyUnderReview = (initial.isSpecialtyApproved ?? true) === false;
  const [pendingSpecialtyChange, setPendingSpecialtyChange] = React.useState(
    () => initial.pendingSpecialtyChange ?? null,
  );
  // One request only: add a specialty (removing is instant with the chip's ✕).
  const [specialtyFormOpen, setSpecialtyFormOpen] = React.useState(false);
  const [specialtyChangeSpec, setSpecialtyChangeSpec] = React.useState({
    specialty: "",
    fromMaster: true,
  });
  const [specialtyChangeLicense, setSpecialtyChangeLicense] = React.useState("");
  const [specialtyErrors, setSpecialtyErrors] = React.useState<AddSpecialtyErrors>({});
  const [specialtyChangeBusy, setSpecialtyChangeBusy] = React.useState(false);
  const [specialtyCancelBusy, setSpecialtyCancelBusy] = React.useState(false);
  const onSpecialtyChangeSpec = React.useCallback(
    (p: { specialty: string; fromMaster: boolean }) => {
      setSpecialtyChangeSpec(p);
      setSpecialtyErrors((prev) => (prev.specialty ? { ...prev, specialty: undefined } : prev));
    },
    [],
  );

  function resetSpecialtyRequestForm() {
    setSpecialtyFormOpen(false);
    setSpecialtyChangeLicense("");
    setSpecialtyErrors({});
    setSpecialtyChangeSpec({ specialty: "", fromMaster: true });
  }

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

  // The hours editor edits the active clinic, which starts as the first one: start
  // from its own hours, not the account's, or the page reads as edited on load.
  const firstWorkplace = initialWorkplacesFromForm(initial)[0];
  const [weeklySchedule, setWeeklySchedule] = React.useState<WeeklySchedule>(
    () => firstWorkplace?.weeklySchedule ?? initial.weeklySchedule,
  );
  const [breakEnabled, setBreakEnabled] = React.useState(
    () => firstWorkplace?.breakEnabled ?? initial.breakEnabled,
  );
  const [breakStart, setBreakStart] = React.useState(() =>
    timeToInputValue(firstWorkplace?.breakStart ?? initial.breakStart),
  );
  const [breakEnd, setBreakEnd] = React.useState(() =>
    timeToInputValue(firstWorkplace?.breakEnd ?? initial.breakEnd),
  );
  const [slotDurationMinutes, setSlotDurationMinutes] = React.useState(
    () => firstWorkplace?.slotDurationMinutes ?? initial.slotDurationMinutes,
  );
  const [workplaces, setWorkplaces] = React.useState<DoctorWorkplaceFormData[]>(
    () => initialWorkplacesFromForm(initial),
  );
  const [activeWorkplaceId, setActiveWorkplaceId] = React.useState(
    () => initialWorkplacesFromForm(initial)[0]?.id ?? "primary",
  );
  const [workplaceBusy, setWorkplaceBusy] = React.useState(false);
  const workplaceTabScrollYRef = React.useRef<number | null>(null);
  /** The clinic card whose hours editor is open (it is also the active workplace). */
  const [editingWorkplaceId, setEditingWorkplaceId] = React.useState<string | null>(null);
  const [workplaceToRemove, setWorkplaceToRemove] = React.useState<string | null>(null);
  const [changeRequestFor, setChangeRequestFor] = React.useState<string | null>(null);
  const [addClinicOpen, setAddClinicOpen] = React.useState(false);
  const [pendingClinicAdds, setPendingClinicAdds] = React.useState<PendingClinicAdd[]>(
    () => initial.pendingClinicAdds ?? [],
  );
  const [pendingClinicChanges, setPendingClinicChanges] = React.useState<
    Record<string, PendingClinicChange>
  >(() => initial.pendingClinicChanges ?? {});

  const [bookingHorizonDays, setBookingHorizonDays] = React.useState(
    initial.bookingHorizonDays
  );
  const [minimumNoticeHours, setMinimumNoticeHours] = React.useState(
    initial.minimumNoticeHours
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
      // The address is read-only here: keep the clinic's own.
      district: current?.district ?? "",
      clinicAddress: current?.clinicAddress ?? "",
      clinicTown: current?.clinicTown ?? null,
      clinicLatitude: current?.clinicLatitude ?? null,
      clinicLongitude: current?.clinicLongitude ?? null,
      clinicPlaceId: current?.clinicPlaceId ?? null,
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

  function openAddClinic() {
    if (workplaces.length + pendingClinicAdds.length >= MAX_DOCTOR_LOCATIONS) {
      toast.error(`You can have up to ${MAX_DOCTOR_LOCATIONS} clinics.`);
      return;
    }
    setAddClinicOpen(true);
  }

  /**
   * Clinics are curated by DocCy, so adding one is a request (contract:
   * POST /api/clinic-requests, docs/handoff/settings-redesign.md): `{ clinicId }` to
   * join a DocCy clinic, else `{ name, phone, location }` for a new one. It shows as a
   * pending card until DocCy approves it.
   */
  async function handleAddWorkplace(clinic: NewClinic): Promise<boolean> {
    try {
      // EXPECTED TO FAIL until Livio builds POST /api/clinic-requests (backend pending, see
      // lib/settings-backend-pending.ts): the doctor sees a message saying so.
      const res = await fetch("/api/clinic-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "add", clinic }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(settingsActionErrorMessage("addClinic", res.status, data, "Could not send the request."));
        return false;
      }
      setPendingClinicAdds((prev) => [
        ...prev,
        { clinic, createdAt: String(data?.request?.createdAt ?? new Date().toISOString()) },
      ]);
      toast.success("Request sent. We’ll email you once the clinic is added.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Could not send the request.");
      return false;
    }
  }

  async function handleRemoveWorkplace(id: string): Promise<boolean> {
    const check = canRemoveClinic(workplaces, id);
    if (check.ok === false) {
      toast.error(check.message);
      return false;
    }
    setWorkplaceBusy(true);
    try {
      // Contract (docs/handoff/settings-redesign.md): the professional leaves the clinic.
      // EXPECTED TO FAIL until Livio builds DELETE /api/professional-clinics (backend pending, see
      // lib/settings-backend-pending.ts): the doctor sees a message saying so.
      const res = await fetch(
        `/api/professional-clinics?locationId=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(settingsActionErrorMessage("removeClinic", res.status, data, "Could not remove clinic."));
        return false;
      }
      const captured = captureActiveWorkplace();
      const remaining = clinicsAfterRemoval(
        workplaces.map((row) => (row.id === captured.id ? captured : row)),
        id,
      );
      setWorkplaces(remaining);
      // The removed clinic is gone on the server too: drop it from the saved snapshot
      // so its absence is not an unsaved change.
      setSavedSnapshot((prev) => ({
        ...prev,
        workplaces: prev.workplaces.filter((row) => row.id !== id),
      }));
      if (editingWorkplaceId === id) setEditingWorkplaceId(null);
      if (activeWorkplaceId === id && remaining[0]) {
        applyWorkplaceToForm(remaining[0]);
      }
      toast.success("Clinic removed.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Could not remove clinic.");
      return false;
    } finally {
      setWorkplaceBusy(false);
    }
  }

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
      specialtyFromMaster:
        (initial.isSpecialtyApproved ?? true) !== false &&
        isCatalogueSpecialty(initial.specialtyOptions, specialty),
      bio: (initial.bio ?? "").trim(),
      languages: Array.isArray(initial.languages) ? [...initial.languages] : [],
      mobileNumber: initial.mobileNumber ?? "",
      bookingHorizonDays: initial.bookingHorizonDays,
      minimumNoticeHours: initial.minimumNoticeHours,
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

  const unsavedSections = React.useMemo(
    () => unsavedSettingsSections(buildCurrentDirtySnapshot(), savedSnapshot),
    [buildCurrentDirtySnapshot, savedSnapshot],
  );
  /** "Discard changes": reload the saved settings without the leave-page prompt. */
  const [discarding, setDiscarding] = React.useState(false);
  React.useEffect(() => {
    if (discarding) window.location.reload();
  }, [discarding]);

  useSettingsUnsavedChangesWarning(hasUnsavedChanges && !discarding);

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
        holidayModeEnabled,
        holidayStartDate: parsedHolidayStart,
        holidayEndDate: parsedHolidayEnd,
        locations: workplacesForSave().map((row) => ({
          id: row.id.startsWith("primary") && row.id === "primary" ? undefined : row.id,
          // No label: the name is DocCy's, and the API leaves the stored label as is.
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

  async function submitSpecialtyChangeRequest() {
    const validated = validateAddSpecialtyRequest(
      {
        specialty: specialtyChangeSpec.specialty,
        fromMaster: specialtyChangeSpec.fromMaster,
        license: specialtyChangeLicense,
      },
      initial.specialtyOptions,
      lockedSpecialties,
    );
    if (validated.ok === false) {
      setSpecialtyErrors(validated.errors);
      return;
    }
    const { request } = validated;
    setSpecialtyChangeBusy(true);
    try {
      const res = await fetch("/api/doctor-specialty-change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data.message as string) || "Could not submit specialty request.");
        return;
      }
      setPendingSpecialtyChange({
        requestKind: request.requestKind,
        fromSpecialty: null,
        toSpecialty: request.toSpecialty,
        licenseNumber: request.licenseNumber,
        createdAt: new Date().toISOString(),
      });
      resetSpecialtyRequestForm();
      toast.success("Request sent. We’ll review it and update your profile.");
    } catch (err) {
      console.error(err);
      toast.error("Could not submit specialty request.");
    } finally {
      setSpecialtyChangeBusy(false);
    }
  }

  /** Withdraws the pending request (contract: DELETE /api/doctor-specialty-change-request). */
  async function cancelSpecialtyRequest() {
    setSpecialtyCancelBusy(true);
    try {
      // EXPECTED TO FAIL until Livio builds DELETE /api/doctor-specialty-change-request
      // (backend pending, see lib/settings-backend-pending.ts): the doctor sees a message saying so.
      const res = await fetch("/api/doctor-specialty-change-request", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          settingsActionErrorMessage("cancelSpecialtyRequest", res.status, data, "Could not cancel the request."),
        );
        return;
      }
      setPendingSpecialtyChange(null);
      toast.success("Request cancelled.");
    } catch (err) {
      console.error(err);
      toast.error("Could not cancel the request.");
    } finally {
      setSpecialtyCancelBusy(false);
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
  const activeWorkplaceLabel = clinicDisplayName(
    workplaces[activeWorkplaceIndex]?.label,
    activeWorkplaceIndex,
    workplaces.length,
  );
  const liveWorkplaces = workplacesForSave();
  const todayKey = cyprusTodayKey();
  const holidayActive =
    holidayModeEnabled &&
    Boolean(holidayStartDate && holidayEndDate) &&
    todayKey >= String(holidayStartDate) &&
    todayKey <= String(holidayEndDate);
  const workplaceName = (row: DoctorWorkplaceFormData, index: number) =>
    clinicDisplayName(row.label, index, liveWorkplaces.length);
  const savedAddressOf = (id: string) =>
    savedSnapshot.workplaces.find((row) => row.id === id)?.clinicAddress ?? "";
  const phoneOf = (id: string) =>
    (initial.clinicPhones ?? []).find((clinic) => clinic.locationId === id)?.phone ?? "";
  const setWorkplacePaused = (id: string, paused: boolean) =>
    setWorkplaces((prev) =>
      prev.map((row) => (row.id === id ? { ...row, pauseOnlineBookings: paused } : row)),
    );
  const removeDialogNameRef = React.useRef("");
  if (workplaceToRemove) {
    const index = liveWorkplaces.findIndex((row) => row.id === workplaceToRemove);
    // Keep the name while the dialog fades out after the clinic is gone.
    if (index !== -1) removeDialogNameRef.current = workplaceName(liveWorkplaces[index]!, index);
  }
  const removeDialogName = removeDialogNameRef.current;
  const savedLocationOf = (id: string) => {
    const saved = savedSnapshot.workplaces.find((row) => row.id === id);
    return clinicLocationFromParts({
      address: saved?.clinicAddress ?? "",
      latitude: saved?.clinicLatitude ?? null,
      longitude: saved?.clinicLongitude ?? null,
      placeId: saved?.clinicPlaceId ?? null,
      district: saved?.district ?? "",
      town: liveWorkplaces.find((row) => row.id === id)?.clinicTown ?? null,
    });
  };
  const changeRequestRow = changeRequestFor
    ? liveWorkplaces.find((row) => row.id === changeRequestFor) ?? null
    : null;

  const unsavedDot = (
    <span className="h-2 w-2 rounded-full bg-amber-300 ring-2 ring-amber-300/30" aria-label="Unsaved changes" />
  );

  const sectionTitle = (title: string, description: string, action?: React.ReactNode) => (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[28px]">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );

  const holidayCard = (
    <div
      className={`rounded-3xl border p-4 transition-colors ${
        holidayModeEnabled
          ? "border-amber-400/40 bg-amber-500/[0.08]"
          : "border-amber-400/20 bg-amber-500/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-amber-100">Holiday mode</p>
        <SettingsSwitch
          tone="amber"
          label="Holiday mode"
          checked={holidayModeEnabled}
          onChange={(enabled) => {
            setHolidayModeEnabled(enabled);
            if (!enabled) {
              setHolidayStartDate(null);
              setHolidayEndDate(null);
              setHolidayStartInput("");
              setHolidayEndInput("");
            }
          }}
        />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        Pauses online booking at every clinic between the dates you pick.
      </p>
      {holidayModeEnabled ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label htmlFor="holidayStart" className="text-[11px] font-semibold text-slate-300">
            From
            <input
              id="holidayStart"
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              value={holidayStartInput}
              onChange={(e) => {
                setHolidayStartInput(e.target.value);
                setHolidayStartDate(parseDDMMYYYYToISO(e.target.value));
              }}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-2.5 py-2 text-sm font-normal text-slate-100 outline-none focus:ring-2 focus:ring-amber-300/50"
            />
          </label>
          <label htmlFor="holidayEnd" className="text-[11px] font-semibold text-slate-300">
            To
            <input
              id="holidayEnd"
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              value={holidayEndInput}
              onChange={(e) => {
                setHolidayEndInput(e.target.value);
                setHolidayEndDate(parseDDMMYYYYToISO(e.target.value));
              }}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-2.5 py-2 text-sm font-normal text-slate-100 outline-none focus:ring-2 focus:ring-amber-300/50"
            />
          </label>
        </div>
      ) : null}
    </div>
  );

  // No name field: patients see DocCy's name for the clinic everywhere (user,
  // 2026-10-01); a rename goes through "Request a change" so DocCy can check that a
  // shared clinic is not renamed by one of its doctors.
  const workplaceEditor = (row: DoctorWorkplaceFormData) => (
    <div className="space-y-5">
      <p className="text-xs text-slate-400" data-testid="settings-clinic-name-note">
        The clinic name and address are DocCy&apos;s, the same for every doctor there. To
        change them, use Request a change.
      </p>

      <div>
        <p className={SECTION_EYEBROW_CLASS}>Working hours</p>
        <div className="mt-2 divide-y divide-slate-800">
          {days.map(({ key, label, value }) => (
            <div key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
              <label className="flex w-36 cursor-pointer items-center gap-2.5">
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
                <span className={`text-sm ${value ? "text-slate-100" : "text-slate-500"}`}>{label}</span>
              </label>
              {value ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <label htmlFor={`${key}-start`} className="sr-only">
                    {label} start time
                  </label>
                  <input
                    id={`${key}-start`}
                    type="time"
                    value={timeToInputValue(weeklySchedule[key].start_time)}
                    onChange={(e) =>
                      setWeeklySchedule((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], start_time: `${e.target.value}:00` },
                      }))
                    }
                    className={`${TIME_INPUT_CLASS} !mt-0 w-32`}
                  />
                  <span aria-hidden>–</span>
                  <label htmlFor={`${key}-end`} className="sr-only">
                    {label} end time
                  </label>
                  <input
                    id={`${key}-end`}
                    type="time"
                    value={timeToInputValue(weeklySchedule[key].end_time)}
                    onChange={(e) =>
                      setWeeklySchedule((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], end_time: `${e.target.value}:00` },
                      }))
                    }
                    className={`${TIME_INPUT_CLASS} !mt-0 w-32`}
                  />
                </div>
              ) : (
                <span className="text-sm text-slate-500">Closed</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className={SECTION_EYEBROW_CLASS}>Daily break</p>
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
          {breakEnabled ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <label htmlFor="breakStart" className="sr-only">
                Break start
              </label>
              <input
                id="breakStart"
                type="time"
                value={breakStart}
                onChange={(e) => setBreakStart(e.target.value)}
                className={`${TIME_INPUT_CLASS} !mt-0 w-32`}
              />
              <span aria-hidden>–</span>
              <label htmlFor="breakEnd" className="sr-only">
                Break end
              </label>
              <input
                id="breakEnd"
                type="time"
                value={breakEnd}
                onChange={(e) => setBreakEnd(e.target.value)}
                className={`${TIME_INPUT_CLASS} !mt-0 w-32`}
              />
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Patients can book any time within your hours.</p>
          )}
        </div>
        <div>
          <p id="slotDurationLabel" className={SECTION_EYEBROW_CLASS}>
            Slot length
          </p>
          <div role="radiogroup" aria-labelledby="slotDurationLabel" className="mt-2 flex flex-wrap gap-1.5">
            {[15, 20, 30, 45, 60].map((n) => {
              const selected = slotDurationMinutes === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSlotDurationMinutes(n)}
                  className={`h-9 rounded-xl border px-3 text-sm font-medium transition ${
                    selected
                      ? "border-clinical-400/60 bg-clinical-500/15 text-clinical-50"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {n} min
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Changes to {activeWorkplaceLabel} are kept when you switch sections. Save them with
        “Save settings”.
      </p>
    </div>
  );

  const availabilitySection = (
    <div className="space-y-5">
      {sectionTitle("Availability", "When patients can book you online, across every clinic.")}
      {holidayActive ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100"
        >
          Holiday mode is on until {holidayEndInput}. No clinic takes online bookings until then.
        </div>
      ) : null}
      <section className={SECTION_CARD_CLASS}>
        <p className={SECTION_EYEBROW_CLASS}>Online booking by clinic</p>
        <ul className="mt-3 divide-y divide-slate-800">
          {liveWorkplaces.map((row, index) => {
            const name = workplaceName(row, index);
            const status = clinicBookingStatus({
              pauseOnlineBookings: row.pauseOnlineBookings,
              holidayActive,
            });
            return (
              <li key={row.id} className="flex items-center gap-3 py-3">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${agendaClinicEventColor(index).swatch}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{name}</p>
                  <p
                    className={`text-xs ${
                      status.kind === "taking" ? "text-wellness-200" : "text-amber-200"
                    }`}
                  >
                    {status.label}
                  </p>
                </div>
                <ClinicBookingSwitch
                  clinicName={name}
                  locationId={row.id === "primary" ? null : row.id}
                  paused={row.pauseOnlineBookings}
                  onPausedChange={(paused) => setWorkplacePaused(row.id, paused)}
                />
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          While a clinic is paused, patients see its phone number instead of your calendar.
        </p>
      </section>
      <section className={SECTION_CARD_CLASS}>
        <p className={SECTION_EYEBROW_CLASS}>Booking limits · all clinics</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="bookingHorizonDays" className="text-sm font-semibold text-slate-100">
              How far ahead
            </label>
            <p className="mt-0.5 text-xs text-slate-400">How far in advance patients can book.</p>
            <select
              id="bookingHorizonDays"
              value={bookingHorizonDays}
              onChange={(e) => {
                const next = Number(e.target.value);
                setBookingHorizonDays(
                  BOOKING_HORIZON_OPTIONS_DAYS.includes(
                    next as (typeof BOOKING_HORIZON_OPTIONS_DAYS)[number],
                  )
                    ? next
                    : DEFAULT_BOOKING_HORIZON_DAYS,
                );
              }}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
            >
              <option value={14}>2 weeks</option>
              <option value={30}>1 month</option>
              <option value={90}>3 months</option>
              <option value={180}>6 months</option>
            </select>
          </div>
          <div>
            <label htmlFor="minimumNoticeHours" className="text-sm font-semibold text-slate-100">
              Minimum notice
            </label>
            <p className="mt-0.5 text-xs text-slate-400">Slots closer than this are hidden.</p>
            <select
              id="minimumNoticeHours"
              value={minimumNoticeHours}
              onChange={(e) => {
                const next = Number(e.target.value);
                setMinimumNoticeHours(
                  MIN_NOTICE_OPTIONS_HOURS.includes(next as (typeof MIN_NOTICE_OPTIONS_HOURS)[number])
                    ? next
                    : DEFAULT_MIN_NOTICE_HOURS,
                );
              }}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
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
          </div>
        </div>
      </section>
    </div>
  );

  const clinicsSection = (
    <div className="space-y-5">
      {sectionTitle(
        "Clinics",
        "Hours, slot length and online booking are set per clinic.",
        <button
          type="button"
          onClick={openAddClinic}
          disabled={workplaceBusy || liveWorkplaces.length >= MAX_DOCTOR_LOCATIONS}
          className="inline-flex h-11 items-center rounded-2xl bg-clinical-500 px-4 text-sm font-semibold text-ink-900 shadow-md shadow-clinical-500/20 transition hover:bg-clinical-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          + Add clinic
        </button>,
      )}
      {liveWorkplaces.map((row, index) => {
        const name = workplaceName(row, index);
        const removal = canRemoveClinic(liveWorkplaces, row.id);
        const savedAddress = savedAddressOf(row.id);
        const editing = editingWorkplaceId === row.id;
        return (
          <ClinicCard
            key={row.id}
            name={name}
            swatchClass={agendaClinicEventColor(index).swatch}
            status={clinicBookingStatus({ pauseOnlineBookings: row.pauseOnlineBookings, holidayActive })}
            bookingSwitch={
              <ClinicBookingSwitch
                clinicName={name}
                locationId={row.id === "primary" ? null : row.id}
                paused={row.pauseOnlineBookings}
                onPausedChange={(paused) => setWorkplacePaused(row.id, paused)}
              />
            }
            address={row.clinicAddress.trim() || savedAddress}
            phone={phoneOf(row.id)}
            pendingChange={pendingClinicChanges[row.id] ?? null}
            onRequestChange={row.id === "primary" ? null : () => setChangeRequestFor(row.id)}
            summary={{
              days: summarizeClinicDays(row.weeklySchedule),
              hours: summarizeClinicHours(row.weeklySchedule),
              breakTime: summarizeClinicBreak(row),
              slot: `${row.slotDurationMinutes} min`,
            }}
            editing={editing}
            editLabel="Edit hours"
            onToggleEdit={() => {
              if (editing) {
                setEditingWorkplaceId(null);
                return;
              }
              handleSelectWorkplace(row.id);
              setEditingWorkplaceId(row.id);
            }}
            editor={row.id === activeWorkplaceId ? workplaceEditor(row) : null}
            removal={removal.ok === false ? { ok: false, message: removal.message } : { ok: true }}
            onRemove={() => setWorkplaceToRemove(row.id)}
            busy={workplaceBusy}
          />
        );
      })}
      {pendingClinicAdds.map((pending, index) => (
        <section
          key={`pending-${index}`}
          data-testid="settings-clinic-pending"
          className="rounded-3xl border border-dashed border-amber-400/50 bg-amber-500/[0.04] p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-slate-50">
              {pending.clinic.name || pending.clinic.location.address}
            </h2>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
              Request in review
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-300">{pending.clinic.location.address}</p>
          <p className="mt-1 text-xs text-slate-400">
            Requested{" "}
            {new Date(pending.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            . You can set its hours once DocCy adds it.
          </p>
        </section>
      ))}
    </div>
  );

  const servicesSection = (
    <div className="space-y-5">
      {sectionTitle(
        "Services & prices",
        "Treatments on your public profile. Prices are in euros (€) and the same at every clinic.",
      )}
      <section className={SECTION_CARD_CLASS}>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="Treatment name (e.g. Facial laser)"
            aria-label="Treatment name"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
          />
          <input
            type="text"
            value={servicePrice}
            onChange={(e) => setServicePrice(e.target.value)}
            placeholder="e.g. 120 or From 80"
            aria-label="Price"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
          />
          <button
            type="button"
            onClick={handleAddService}
            disabled={serviceSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-clinical-500 px-4 py-2 text-sm font-semibold text-ink-900 transition hover:bg-clinical-400 disabled:opacity-60"
          >
            {serviceSubmitting ? "Adding..." : "Add"}
          </button>
        </div>
        {services.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-800">
            {services.map((service) => (
              <li key={service.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{service.name}</p>
                  {service.price ? <p className="text-xs text-slate-400">{service.price}</p> : null}
                </div>
                <button
                  type="button"
                  disabled={deletingServiceId === service.id}
                  onClick={() => handleDeleteService(service.id)}
                  aria-label={`Delete ${service.name}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            Add what you offer so patients know what to book you for.
          </p>
        )}
      </section>
    </div>
  );

  const pendingChip = pendingSpecialtyChange ? pendingSpecialtyChip(pendingSpecialtyChange) : null;
  const specialtiesCard = (
    <section className={SECTION_CARD_CLASS} data-testid="settings-specialties">
      <p className={SECTION_EYEBROW_CLASS}>Specialties</p>
      <div data-testid="settings-specialty-locked" className="mt-3">
        {lockedSpecialties.length > 0 || pendingChip ? (
          <ul className="flex flex-wrap gap-2">
            {lockedSpecialties.map((label) => {
              const removable = canRemoveSpecialty(lockedSpecialties, label).ok;
              return (
                <li
                  key={label}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-600 bg-slate-950/70 text-sm font-semibold text-slate-100 ${
                    removable ? "pl-3.5 pr-1.5" : "px-3.5"
                  }`}
                >
                  {label}
                  {removable ? (
                    <button
                      type="button"
                      aria-label={`Remove ${label}`}
                      onClick={() => setSpecialtyToRemove(label)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition hover:bg-rose-500/15 hover:text-rose-200"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  )}
                </li>
              );
            })}
            {pendingChip ? (
              <li
                data-testid="settings-specialty-change-pending"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-amber-300/50 bg-amber-500/[0.07] pl-3 pr-1.5 text-sm font-semibold text-amber-50"
              >
                <Clock className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                {pendingChip.label}
                <span className="text-xs font-medium text-amber-200/80">{pendingChip.status}</span>
                <button
                  type="button"
                  aria-label={`Cancel the request for ${pendingChip.label}`}
                  disabled={specialtyCancelBusy}
                  onClick={() => void cancelSpecialtyRequest()}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-amber-200 transition hover:bg-amber-400/15 hover:text-amber-50 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm font-medium text-slate-100">Not set</p>
        )}
        {specialtyUnderReview ? (
          <p className="mt-2 text-xs text-amber-200/90">
            {PUBLIC_SPECIALTY_UNDER_REVIEW_LABEL} — visible on your public profile until approved.
          </p>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        {pendingChip
          ? "DocCy is checking your request. You can add another specialty once it’s reviewed."
          : lockedSpecialties.length > 1
            ? "Remove a specialty with ✕. Adding one needs a quick check by DocCy."
            : `${LAST_SPECIALTY_MESSAGE} To switch it, add the new one; once it’s approved, remove the old one.`}
      </p>
      {pendingChip ? null : specialtyFormOpen ? (
        <div
          data-testid="settings-specialty-change-form"
          className="mt-3 space-y-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-4"
        >
          <div>
            <p className={SECTION_EYEBROW_CLASS}>
              Specialty to add <span className="text-red-300">*</span>
            </p>
            <SpecialtyCombobox
              id="settings-specialty-change"
              initialSpecialty=""
              options={initial.specialtyOptions}
              initialIsApproved
              variant="settings"
              excludeSpecialties={lockedSpecialties}
              onSelectionChange={onSpecialtyChangeSpec}
            />
            {specialtyErrors.specialty ? (
              <p
                className="mt-1.5 text-xs font-medium text-red-300"
                role="alert"
                data-testid="settings-specialty-error"
              >
                {specialtyErrors.specialty}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="settings-specialty-change-license" className={SECTION_EYEBROW_CLASS}>
              License / certification number <span className="text-red-300">*</span>
            </label>
            <p id="settings-specialty-change-license-help" className="mt-1 text-xs text-slate-400">
              {SPECIALTY_LICENSE_HELP}
            </p>
            <input
              id="settings-specialty-change-license"
              type="text"
              value={specialtyChangeLicense}
              onChange={(e) => {
                setSpecialtyChangeLicense(e.target.value);
                if (specialtyErrors.license) setSpecialtyErrors((prev) => ({ ...prev, license: undefined }));
              }}
              aria-invalid={specialtyErrors.license ? true : undefined}
              aria-describedby={
                specialtyErrors.license
                  ? "settings-specialty-change-license-help settings-specialty-license-error"
                  : "settings-specialty-change-license-help"
              }
              placeholder="e.g. Cyprus Medical Council number"
              className={`mt-2 w-full rounded-xl border bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:ring-2 ${
                specialtyErrors.license
                  ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/25"
                  : "border-slate-700 focus:border-clinical-400/60 focus:ring-clinical-400/30"
              }`}
            />
            {specialtyErrors.license ? (
              <p
                id="settings-specialty-license-error"
                className="mt-1.5 text-xs font-medium text-red-300"
                role="alert"
              >
                {specialtyErrors.license}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="settings-specialty-change-submit"
              disabled={specialtyChangeBusy}
              onClick={() => void submitSpecialtyChangeRequest()}
              className="inline-flex items-center justify-center rounded-xl bg-clinical-500 px-4 py-2 text-sm font-semibold text-ink-900 transition hover:bg-clinical-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {specialtyChangeBusy ? "Sending…" : "Send request"}
            </button>
            <button
              type="button"
              disabled={specialtyChangeBusy}
              onClick={resetSpecialtyRequestForm}
              className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-testid="settings-specialty-change-request"
          onClick={() => setSpecialtyFormOpen(true)}
          className="mt-3 text-sm font-semibold text-clinical-300 transition hover:text-clinical-200"
        >
          + Add a specialty
        </button>
      )}
    </section>
  );

  const profileSection = (
    <div className="space-y-5">
      {sectionTitle("Profile", "What patients see about you in Health Finder and on your profile.")}
      <section className={SECTION_CARD_CLASS}>
        <p className={SECTION_EYEBROW_CLASS}>Profile photo</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-700 bg-ink-900/70">
            {avatarPreviewUrl ? (
              <img src={avatarPreviewUrl} alt="Profile preview" className="h-full w-full object-cover" />
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
            className="inline-flex h-10 items-center rounded-xl border border-white/20 px-3.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {avatarUploading ? "Uploading..." : "Upload new photo"}
          </button>
        </div>
      </section>
      {specialtiesCard}
      <section className={SECTION_CARD_CLASS}>
        <label htmlFor="settings-bio" className={SECTION_EYEBROW_CLASS}>
          How you help patients
        </label>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Write what you treat and how you help. DocCy uses this to match you with the right
          patients.
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
        <p className={`${SECTION_EYEBROW_CLASS} mt-4`}>
          Languages <span className="text-red-300">*</span>
        </p>
        <LanguageMultiSelect
          id="settings-languages"
          selected={languages}
          onSelectedChange={setLanguages}
          variant="settings"
        />
      </section>
      {profileExtra}
    </div>
  );

  const contactSection = (
    <div className="space-y-5">
      {sectionTitle("Contact & phone", "How DocCy and your patients reach you.")}
      <PhoneNumbersSettings
        mobileNumber={mobileNumber}
        onMobileNumberChange={setMobileNumber}
        clinicPhones={initial.clinicPhones ?? []}
        onOpenClinics={() => selectSection("clinics")}
      />
    </div>
  );

  const accountSection = (
    <div className="space-y-5">
      {sectionTitle("Account", "Your sessions and the material to promote your practice.")}
      {account}
    </div>
  );

  const sections: Record<SettingsSectionId, React.ReactNode> = {
    availability: availabilitySection,
    clinics: clinicsSection,
    services: servicesSection,
    profile: profileSection,
    contact: contactSection,
    account: accountSection,
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <SettingsSidebar
        active={section}
        onSelect={selectSection}
        header={sidebarHeader}
        badges={{
          clinics: (
            <span className="inline-flex items-center gap-1.5">
              {unsavedSections.includes("clinics") ? unsavedDot : null}
              <span className="text-xs tabular-nums text-clinical-300">{liveWorkplaces.length}</span>
            </span>
          ),
          availability: unsavedSections.includes("availability") ? unsavedDot : null,
          contact: unsavedSections.includes("contact") ? unsavedDot : null,
          profile: unsavedSections.includes("profile") ? (
            unsavedDot
          ) : pendingSpecialtyChange ? (
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="Request in review" />
          ) : null,
        }}
        footer={holidayCard}
      />

      <div className="min-w-0 flex-1 space-y-5 pb-4">
        {SETTINGS_SECTIONS.map(({ id }) => (
          <div key={id} hidden={id !== section} className={id === section ? "settings-section-enter" : undefined}>
            {sections[id]}
          </div>
        ))}


        {hasUnsavedChanges ? (
          <div
            role="status"
            data-testid="settings-unsaved-changes"
            className="sticky bottom-24 z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/30 bg-[#0B1A30]/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur lg:bottom-6"
          >
            <p className="min-w-0 flex-1 text-sm text-amber-100">
              {unsavedSections.length > 0 ? (
                <>
                  Unsaved changes in{" "}
                  {unsavedSections.map((id, index) => (
                    <React.Fragment key={id}>
                      {index > 0 ? (index === unsavedSections.length - 1 ? " and " : ", ") : null}
                      <button
                        type="button"
                        onClick={() => selectSection(id)}
                        className="font-semibold underline decoration-amber-300/50 underline-offset-2 hover:text-amber-50"
                      >
                        {SETTINGS_SECTIONS.find((s) => s.id === id)?.label ?? id}
                      </button>
                    </React.Fragment>
                  ))}
                  .
                </>
              ) : (
                "You have unsaved changes."
              )}
            </p>
            {message?.type === "error" ? (
              <p className="w-full text-sm text-red-200 sm:order-last" role="alert">
                {message.text}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setDiscarding(true)}
              disabled={saving || discarding}
              className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-slate-50 disabled:opacity-60"
            >
              Discard changes
            </button>
            <button
              type="submit"
              disabled={saving || discarding}
              className="inline-flex h-10 items-center rounded-xl bg-clinical-500 px-4 text-sm font-semibold text-ink-900 transition hover:bg-clinical-400 disabled:opacity-60"
            >
              <Save className="mr-2 h-4 w-4" aria-hidden />
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        ) : null}
      </div>

      {workplaceToRemove ? (
        <SettingsDialog
          title={`Remove ${removeDialogName}?`}
          description="Patients won’t find you at this clinic any more. A clinic with upcoming or requested appointments can’t be removed until you move or cancel them."
          onClose={() => setWorkplaceToRemove(null)}
          footer={(close) => (
            <>
              <button
                type="button"
                onClick={close}
                disabled={workplaceBusy}
                className={dialogSecondaryButtonClass}
              >
                Keep clinic
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await handleRemoveWorkplace(workplaceToRemove)) close();
                }}
                disabled={workplaceBusy}
                className={dialogDangerButtonClass}
              >
                {workplaceBusy ? "Removing…" : "Remove clinic"}
              </button>
            </>
          )}
        />
      ) : null}

      {changeRequestRow ? (
        <ClinicChangeRequestDialog
          clinicName={workplaceName(changeRequestRow, liveWorkplaces.indexOf(changeRequestRow))}
          locationId={changeRequestRow.id}
          current={{
            clinicId: null,
            name:
              String(changeRequestRow.label ?? "").trim() ||
              workplaceName(changeRequestRow, liveWorkplaces.indexOf(changeRequestRow)),
            phone: phoneOf(changeRequestRow.id),
            location: savedLocationOf(changeRequestRow.id),
          }}
          onClose={() => setChangeRequestFor(null)}
          onSent={(pending) =>
            setPendingClinicChanges((prev) => ({ ...prev, [changeRequestRow.id]: pending }))
          }
        />
      ) : null}

      {addClinicOpen ? (
        <AddClinicDialog onClose={() => setAddClinicOpen(false)} onAdd={handleAddWorkplace} />
      ) : null}

      {specialtyToRemove ? (
        <SettingsDialog
          title={`Remove ${specialtyToRemove}?`}
          description="It comes off your profile and Health Finder right away. To add it back later, you’ll need to request it again."
          onClose={() => setSpecialtyToRemove(null)}
          footer={(close) => (
            <>
              <button
                type="button"
                onClick={close}
                disabled={specialtyRemoving}
                className={dialogSecondaryButtonClass}
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await handleRemoveSpecialty(specialtyToRemove)) close();
                }}
                disabled={specialtyRemoving}
                className={dialogDangerButtonClass}
              >
                {specialtyRemoving ? "Removing…" : "Remove"}
              </button>
            </>
          )}
        />
      ) : null}

      {isClient && avatarCropOpen && avatarSourceUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-ink-900/75 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Crop profile photo"
            >
              <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
                <p className="mb-2 text-sm font-semibold text-slate-100">Crop profile photo (1:1)</p>
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
                    {avatarCropping ? "Processing..." : avatarUploading ? "Uploading..." : "Confirm crop"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </form>
  );
}
