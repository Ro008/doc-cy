import {
  CLINIC_ADDRESS,
  buildMapsUrlFromAddress,
} from "@/lib/clinic-info";
import {
  clinicDisplayName,
  sortDoctorLocations,
  type DoctorLocationRow,
} from "@/lib/doctor-locations";
import {
  EMAIL_LINK_ACCENT,
  EMAIL_SECTION_LABEL,
  EMAIL_TEXT,
} from "@/lib/email-brand";
import { escapeHtml } from "@/lib/resend";

export type AppointmentClinicCopy = {
  clinicName: string;
  address: string;
  mapsUrl: string;
};

type LocationLike = Pick<
  DoctorLocationRow,
  "id" | "label" | "clinic_address" | "is_primary" | "sort_order"
> & { created_at?: string };

/**
 * Resolve clinic name + address for booking emails / calendar LOCATION from the
 * appointment's `location_id` (falls back to primary / doctor.clinic_address).
 */
export function appointmentClinicCopy(opts: {
  locations: readonly LocationLike[];
  locationId?: string | null;
  doctorClinicAddressFallback?: string | null;
}): AppointmentClinicCopy {
  const sorted = sortDoctorLocations(opts.locations);
  const requestedId = String(opts.locationId ?? "").trim();
  const selected =
    (requestedId ? sorted.find((row) => row.id === requestedId) : null) ??
    (sorted.length === 1 ? sorted[0] : null) ??
    sorted[0] ??
    null;

  const index = selected
    ? Math.max(
        0,
        sorted.findIndex((row) => row.id === selected.id),
      )
    : 0;
  const total = Math.max(sorted.length, 1);
  const clinicName = clinicDisplayName(selected?.label, index, total);
  const address =
    String(selected?.clinic_address ?? "").trim() ||
    String(opts.doctorClinicAddressFallback ?? "").trim() ||
    CLINIC_ADDRESS;

  return {
    clinicName,
    address,
    mapsUrl: buildMapsUrlFromAddress(address),
  };
}

/** Flat fallback when the caller only has an address (legacy single-clinic paths). */
export function appointmentClinicCopyFromAddress(opts: {
  clinicName?: string | null;
  address?: string | null;
}): AppointmentClinicCopy {
  const address = String(opts.address ?? "").trim() || CLINIC_ADDRESS;
  const clinicName = String(opts.clinicName ?? "").trim() || "Clinic";
  return {
    clinicName,
    address,
    mapsUrl: buildMapsUrlFromAddress(address),
  };
}

export function formatAppointmentClinicEmailText(
  clinic: AppointmentClinicCopy,
): string {
  return (
    `Clinic: ${clinic.clinicName}\n` +
    `Address: ${clinic.address}\n` +
    `Maps: ${clinic.mapsUrl}\n`
  );
}

export function formatAppointmentClinicEmailHtml(
  clinic: AppointmentClinicCopy,
): string {
  return `
    <p style="${EMAIL_SECTION_LABEL}">Clinic</p>
    <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      <strong>${escapeHtml(clinic.clinicName)}</strong>
    </p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      <a href="${escapeHtml(clinic.mapsUrl)}" style="${EMAIL_LINK_ACCENT}">${escapeHtml(clinic.address)}</a>
    </p>`;
}
