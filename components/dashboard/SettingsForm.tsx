"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import { SpecialtyCombobox } from "@/components/specialties/SpecialtyCombobox";
import { LanguageMultiSelect } from "@/components/languages/LanguageMultiSelect";
import { isMasterSpecialty } from "@/lib/cyprus-specialties";
import { validateSpecialtySubmission } from "@/lib/specialty-submission";
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
import { CYPRUS_DISTRICTS, isCyprusDistrict } from "@/lib/cyprus-districts";

export type DoctorSettingsFormData = {
  doctorId: string;
  doctorName: string;
  avatarUrl?: string | null;
  /** Shown in directory & public profile */
  specialty: string;
  /** false = custom “Other” text pending founder approval */
  isSpecialtyApproved?: boolean;
  /** Canonical labels, saved as string[] on doctors */
  languages: string[];
  whatsappNumber?: string;
  district: string;
  clinicAddress: string;
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
  services: DoctorServiceItem[];
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

export function SettingsForm({ initial }: SettingsFormProps) {
  const [isClient, setIsClient] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [spec, setSpec] = React.useState(() => {
    const s = (initial.specialty ?? "").trim();
    const fromMaster =
      (initial.isSpecialtyApproved ?? true) !== false && isMasterSpecialty(s);
    return { specialty: s, fromMaster };
  });
  const onSpecChange = React.useCallback(
    (p: { specialty: string; fromMaster: boolean }) => {
      setSpec(p);
    },
    []
  );

  const [languages, setLanguages] = React.useState<string[]>(() =>
    Array.isArray(initial.languages) ? [...initial.languages] : []
  );

  const [whatsappNumber, setWhatsappNumber] = React.useState(
    initial.whatsappNumber ?? ""
  );
  const [district, setDistrict] = React.useState(initial.district ?? "");
  const [clinicAddress, setClinicAddress] = React.useState(initial.clinicAddress ?? "");

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
    const specResult = validateSpecialtySubmission(
      spec.specialty,
      spec.fromMaster
    );
    if (specResult.ok === false) {
      const text = specResult.message;
      setMessage({ type: "error", text });
      toast.error(text);
      return;
    }
    if (langList.length === 0) {
      const text = "Add at least one language (e.g. English, Greek).";
      setMessage({ type: "error", text });
      toast.error(text);
      return;
    }
    if (!isCyprusDistrict(district)) {
      const text = "Select your district so patients can find you in Health Finder.";
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
      const res = await fetch("/api/doctor-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: initial.doctorId,
          doctorPhone: whatsappNumber || null,
          district,
          clinicAddress: clinicAddress.trim() || null,
          specialty: specResult.specialty,
          specialtyFromMaster: specResult.is_specialty_approved,
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
        }),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Directory &amp; profile
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Required so patients can find you by specialty and language.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Specialty <span className="text-red-300">*</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Search the list or choose Other if needed — custom entries are reviewed.
            </p>
            <SpecialtyCombobox
              id="settings-specialty"
              initialSpecialty={initial.specialty ?? ""}
              initialIsApproved={initial.isSpecialtyApproved ?? true}
              variant="settings"
              onSelectionChange={onSpecChange}
            />
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
              requiredHint
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Finder location
        </p>
        <p className="mt-1 text-sm text-slate-400">
          District is required for Health Finder ranking and filtering.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="district"
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              District <span className="text-red-300">*</span>
            </label>
            <select
              id="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              <option value="">Select district</option>
              {CYPRUS_DISTRICTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="clinicAddress"
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              Clinic address
            </label>
            <input
              id="clinicAddress"
              type="text"
              value={clinicAddress}
              onChange={(e) => setClinicAddress(e.target.value)}
              placeholder="Street, number, area"
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
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
          <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-700 bg-slate-950/70">
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
            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {avatarUploading ? "Uploading..." : "Upload new photo"}
          </button>
        </div>
      </div>
      {isClient && avatarCropOpen && avatarSourceUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/75 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Crop profile photo"
            >
              <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
                <p className="mb-2 text-sm font-semibold text-slate-100">
                  Crop profile photo (1:1)
                </p>
                <div className="relative h-72 overflow-hidden rounded-xl bg-slate-950">
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
                    className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60"
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

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <label
          htmlFor="whatsappNumber"
          className="text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          WhatsApp Number (with country code, e.g., +357...)
        </label>
        <input
          id="whatsappNumber"
          type="text"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          placeholder="+357..."
          className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
        />
        <p className="mt-2 text-xs text-slate-400">
          Used in appointment confirmation emails to enable{" "}
          <span className="font-medium text-slate-300">Chat on WhatsApp</span>.
        </p>
      </div>

      <section className="rounded-2xl border border-[#00FFD5]/30 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#00FFD5]">
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
            className="w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00FFD5]/60"
          />
          <input
            type="text"
            value={servicePrice}
            onChange={(e) => setServicePrice(e.target.value)}
            placeholder="e.g. 120 or From 80"
            className="w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00FFD5]/60"
          />
          <button
            type="button"
            onClick={handleAddService}
            disabled={serviceSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-[#00FFD5] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
          >
            {serviceSubmitting ? "Adding..." : "Add"}
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {services.map((service) => (
            <li
              key={service.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-950/35 px-3 py-2.5"
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
          Working days
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Select the days you see patients.
        </p>
        <div className="mt-4 space-y-3">
          {days.map(({ key, label, value }) => (
            <div
              key={key}
              className="rounded-xl border border-slate-800/70 bg-slate-950/30 p-3"
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
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400/60"
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
                      className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
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
                      className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Scheduling Boundaries
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
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
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
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
            </select>
            <p className="mt-2 text-xs text-slate-400">
              Prevent last-minute surprises. Slots will be hidden if they are too close to the current time.
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
              Completely block bookings during a date range.
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
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400/60"
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
                className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
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
                className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Daily break (optional)
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Patients will not be able to book during this time.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={breakEnabled}
              onChange={(e) => setBreakEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400/60"
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
                className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
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
                className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <label
          htmlFor="slotDuration"
          className="text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          Appointment slot duration (minutes)
        </label>
        <p className="mt-1 text-sm text-slate-300">
          e.g. 30 for 30-minute slots.
        </p>
        <select
          id="slotDuration"
          value={slotDurationMinutes}
          onChange={(e) =>
            setSlotDurationMinutes(Number(e.target.value))
          }
          className="mt-3 w-full max-w-xs rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
        >
          {[15, 20, 30, 45, 60].map((n) => (
            <option key={n} value={n}>
              {n} min
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
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
          className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 disabled:opacity-60"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save settings"}
        </button>
        <Link
          href="/agenda"
          className="inline-flex items-center text-sm text-slate-400 transition hover:text-slate-200"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to agenda
        </Link>
      </div>
    </form>
  );
}
