import type { SupabaseClient } from "@supabase/supabase-js";

import { clinicMapsUrl } from "@/lib/clinic-info";
import { EMAIL_LINK_ACCENT, EMAIL_SECTION_LABEL, EMAIL_TEXT } from "@/lib/email-brand";
import { formatCyprusPhoneDisplay, phoneToTelHref } from "@/lib/phone-link";
import { escapeHtml } from "@/lib/resend";

/**
 * The clinic block of every email to a patient (user, 2026-10-07): the clinic name linking to
 * the professional's profile, the address linking to the clinic's Maps pin, and the clinic
 * phone, with the Cyprus prefix, linking to call.
 */
export type PatientEmailClinic = {
  name: string;
  address?: string | null;
  /** The clinic's Maps pin (`clinicMapsUrl`). */
  mapsUrl?: string | null;
  /** The clinic's phone as stored (8 digits); shown as +357 XX XXXXXX. */
  phone?: string | null;
  /** The professional's public profile. */
  profileUrl?: string | null;
};

/** The English public profile of a professional, or null without a slug. */
export function patientClinicProfileUrl(siteUrl: string, slug: string | null | undefined): string | null {
  const s = String(slug ?? "").trim();
  if (!s) return null;
  return new URL(`/en/${encodeURIComponent(s)}`, siteUrl).toString();
}

export function patientClinicBlockText(clinic: PatientEmailClinic): string {
  const telHref = phoneToTelHref(clinic.phone);
  const lines = [`Clinic: ${clinic.name}`];
  if (clinic.profileUrl) lines.push(`Profile: ${clinic.profileUrl}`);
  if (clinic.address) lines.push(`Address: ${clinic.address}`);
  if (clinic.address && clinic.mapsUrl) lines.push(`Maps: ${clinic.mapsUrl}`);
  if (telHref) lines.push(`Phone: ${formatCyprusPhoneDisplay(clinic.phone)}`);
  return `${lines.join("\n")}\n`;
}

const LINE = `margin:0 0 4px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};`;

export function patientClinicBlockHtml(clinic: PatientEmailClinic): string {
  const name = `<strong>${escapeHtml(clinic.name)}</strong>`;
  const nameLine = clinic.profileUrl
    ? `<a href="${escapeHtml(clinic.profileUrl)}" style="${EMAIL_LINK_ACCENT}">${name}</a>`
    : name;
  const address = clinic.address?.trim();
  const maps =
    String(clinic.mapsUrl ?? "").trim() ||
    (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "");
  const addressLine = address
    ? `<p style="${LINE}"><a href="${escapeHtml(maps)}" style="${EMAIL_LINK_ACCENT}">${escapeHtml(address)}</a></p>`
    : "";
  const telHref = phoneToTelHref(clinic.phone);
  const phoneLine = telHref
    ? `<p style="${LINE}"><a href="${escapeHtml(telHref)}" style="${EMAIL_LINK_ACCENT}">${escapeHtml(
        formatCyprusPhoneDisplay(clinic.phone),
      )}</a></p>`
    : "";
  return `<p style="${EMAIL_SECTION_LABEL}">Clinic</p>
    <p style="${LINE}">${nameLine}</p>
    ${addressLine}
    ${phoneLine}
    <div style="height:10px;line-height:10px;">&nbsp;</div>`;
}

/**
 * The clinic an appointment is at, ready for a patient email. Server-only: it reads the
 * clinic's phone, which stays out of public page data. Null when the appointment has no clinic.
 */
export async function loadPatientEmailClinic(
  service: SupabaseClient,
  opts: { clinicId: string | null | undefined; professionalSlug: string | null | undefined; siteUrl: string },
): Promise<PatientEmailClinic | null> {
  const id = String(opts.clinicId ?? "").trim();
  if (!id) return null;
  const { data, error } = await service
    .from("clinics")
    .select("name, address, phone, address_maps_link, latitude, longitude")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const c = data as {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    address_maps_link?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  const address = String(c.address ?? "").trim() || null;
  return {
    name: String(c.name ?? "").trim() || "Clinic",
    address,
    mapsUrl: clinicMapsUrl({
      mapsLink: c.address_maps_link,
      latitude: c.latitude,
      longitude: c.longitude,
      address,
    }),
    phone: String(c.phone ?? "").trim() || null,
    profileUrl: patientClinicProfileUrl(opts.siteUrl, opts.professionalSlug),
  };
}
