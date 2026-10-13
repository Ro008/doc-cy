import { normalizeCyprusClinicPhone } from "@/lib/clinic-phone";
import { clinicPinMoved } from "@/lib/clinic-requests";
import type { ClinicLocation } from "@/lib/clinic-location";
import { registerClinicLocationIsComplete } from "@/lib/register-clinic-location";

/**
 * What the Clinics forms in Settings send (user, 2026-10-11). "Add clinic" uses the
 * picker of /register: a DocCy clinic first (joined at once), else Google Maps or a pin
 * with a name and phone (a request). "Request a change to clinic details" is only about
 * the name, address and phone of a clinic she works at.
 * Contracts: POST /api/professional-clinics, /api/clinic-requests and
 * /api/clinic-change-requests.
 */

export type ClinicPick = {
  /** The DocCy clinic picked from the search; null for Google / pin. */
  clinicId: string | null;
  name: string;
  phone: string;
  location: ClinicLocation;
};

export type ClinicPinFields = Pick<ClinicLocation, "latitude" | "longitude" | "placeId" | "district" | "town">;

export type ClinicChanges = {
  name?: string;
  address?: string;
  location?: ClinicPinFields;
  phone?: string;
};

type Field = "location" | "name" | "phone";

export type ClinicChangeRequestValidation =
  | { ok: true; changes: ClinicChanges }
  | { ok: false; field: Field | null; message: string };

export type NewClinicValidation =
  | {
      ok: true;
      clinic:
        | { clinicId: string; name: string; location: ClinicLocation }
        | { clinicId: null; name: string; phone: string; location: ClinicLocation };
    }
  | { ok: false; field: Field; message: string };

function clean(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function phoneKey(value: string): string {
  return normalizeCyprusClinicPhone(value) ?? value.replace(/\D/g, "");
}

function pinFields(location: ClinicLocation): ClinicPinFields {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    placeId: location.placeId,
    district: location.district,
    town: location.town,
  };
}

/** The same cap as the clinic name field on /register. */
export const MAX_REQUESTED_CLINIC_NAME_LENGTH = 120;

function checkName(name: string): { field: Field; message: string } | null {
  if (!name) return { field: "name", message: "Enter the clinic name." };
  if (name.length > MAX_REQUESTED_CLINIC_NAME_LENGTH) {
    return {
      field: "name",
      message: `Keep the clinic name under ${MAX_REQUESTED_CLINIC_NAME_LENGTH} characters.`,
    };
  }
  return null;
}

const PHONE_MESSAGE = "Enter a Cyprus landline or mobile, e.g. 25 123456.";

export function validateClinicChangeRequest(input: {
  current: { name: string; address: string; phone: string; latitude?: number | null; longitude?: number | null };
  requested: ClinicPick;
}): ClinicChangeRequestValidation {
  const { current, requested } = input;
  const name = clean(requested.name);
  const address = clean(requested.location.address);

  const nameError = checkName(name);
  if (nameError) return { ok: false, ...nameError };

  const changes: ClinicChanges = {};
  if (name !== clean(current.name)) changes.name = name;

  const pinMoved =
    current.latitude !== undefined &&
    registerClinicLocationIsComplete(requested.location) &&
    clinicPinMoved(current, {
      latitude: requested.location.latitude as number,
      longitude: requested.location.longitude as number,
    });
  if (address !== clean(current.address) || pinMoved) {
    if (!registerClinicLocationIsComplete(requested.location)) {
      return { ok: false, field: "location", message: "Pick the address from the suggestions or drop a pin." };
    }
    changes.address = address;
    changes.location = pinFields(requested.location);
  }

  const phone = clean(requested.phone);
  const currentPhone = clean(current.phone);
  if (phone) {
    const normalized = normalizeCyprusClinicPhone(phone);
    if (!normalized) return { ok: false, field: "phone", message: PHONE_MESSAGE };
    if (normalized !== phoneKey(currentPhone)) changes.phone = normalized;
  } else if (currentPhone) {
    return { ok: false, field: "phone", message: "Enter the clinic phone." };
  }

  if (Object.keys(changes).length === 0) {
    return { ok: false, field: null, message: "Change at least one detail." };
  }
  return { ok: true, changes };
}

export function validateNewClinic(pick: ClinicPick): NewClinicValidation {
  if (!registerClinicLocationIsComplete(pick.location)) {
    return { ok: false, field: "location", message: "Find your clinic first." };
  }
  const name = clean(pick.name);
  if (pick.clinicId) {
    return { ok: true, clinic: { clinicId: pick.clinicId, name, location: pick.location } };
  }
  const nameError = checkName(name);
  if (nameError) return { ok: false, ...nameError };
  const phone = normalizeCyprusClinicPhone(pick.phone);
  if (!phone) return { ok: false, field: "phone", message: PHONE_MESSAGE };
  return { ok: true, clinic: { clinicId: null, name, phone, location: pick.location } };
}
