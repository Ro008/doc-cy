import { tooOftenRefusal } from "@/lib/request-frequency";
import { normalizeCyprusClinicPhone } from "@/lib/clinic-phone";
import { isCyprusDistrict } from "@/lib/cyprus-districts";
import { formatCyprusPhoneDisplay } from "@/lib/phone-link";

/**
 * Clinic requests from Settings → Clinics (user, 2026-10-11). Two things need a
 * founder, because clinics are curated by DocCy and shared by those who work there:
 * a clinic DocCy does not have yet, and a change to a clinic's name, address or phone.
 * Each is a request_log row born "pending" (migration *_professional_clinic_requests):
 * one new-clinic request waiting at a time, one open details request per clinic, both
 * withdrawn by her while open. This file is the part with no database in it (the
 * Settings page imports it too).
 */

export const CLINIC_ADD_REQUEST_TYPE = "professional_clinic_add";
export const CLINIC_DETAILS_REQUEST_TYPE = "professional_clinic_details_change";
export const CLINIC_REQUEST_TYPES = [CLINIC_ADD_REQUEST_TYPE, CLINIC_DETAILS_REQUEST_TYPE] as const;
export type ClinicRequestType = (typeof CLINIC_REQUEST_TYPES)[number];

export const CLINIC_NAME_MAX_LENGTH = 120;
const PHONE_MESSAGE = "Enter a Cyprus landline or mobile, e.g. 25 123456.";

/** A clinic's place as request_log keeps it (the keys a clinic proposed at registration has). */
export type ClinicPlace = {
  district: string;
  town: string | null;
  latitude: number;
  longitude: number;
  place_id: string | null;
};

/** `details` of a professional_clinic_add request. */
export type NewClinicDetails = ClinicPlace & { name: string; address: string; phone: string };

/** `details.changes` of a professional_clinic_details_change request. */
export type ClinicDetailsChanges = { name?: string; address?: string; location?: ClinicPlace; phone?: string };

type Checked<T> = ({ ok: true } & T) | { ok: false; message: string };

const clean = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

function checkName(name: string): string | null {
  if (!name) return "Enter the clinic name.";
  if (name.length > CLINIC_NAME_MAX_LENGTH) return `Keep the clinic name under ${CLINIC_NAME_MAX_LENGTH} characters.`;
  return null;
}

/** The pin the page sends ({ latitude, longitude, placeId, district, town }) as it is kept. */
function placeFrom(value: unknown): ClinicPlace | null {
  const raw = (value ?? {}) as Record<string, unknown>;
  const district = clean(raw.district);
  const latitude = typeof raw.latitude === "number" ? raw.latitude : NaN;
  const longitude = typeof raw.longitude === "number" ? raw.longitude : NaN;
  if (!isCyprusDistrict(district) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    district,
    town: clean(raw.town) || null,
    latitude,
    longitude,
    place_id: clean(raw.placeId ?? raw.place_id) || null,
  };
}

/** A new clinic as Settings sends it: `{ name, phone, location: { address, … } }`. */
export function newClinicDetailsFromBody(body: unknown): Checked<{ details: NewClinicDetails }> {
  const raw = (body ?? {}) as Record<string, unknown>;
  const name = clean(raw.name);
  const nameError = checkName(name);
  if (nameError) return { ok: false, message: nameError };
  const address = clean((raw.location as Record<string, unknown> | null | undefined)?.address);
  const place = placeFrom(raw.location);
  if (!address || !place) return { ok: false, message: "Find the clinic on Google Maps or drop a pin first." };
  const phone = normalizeCyprusClinicPhone(clean(raw.phone));
  if (!phone) return { ok: false, message: PHONE_MESSAGE };
  return { ok: true, details: { name, address, ...place, phone } };
}

/** True when the pin sits somewhere else (a metre or so does not count). */
export function clinicPinMoved(
  current: { latitude?: number | null; longitude?: number | null },
  next: { latitude: number; longitude: number },
): boolean {
  if (typeof current.latitude !== "number" || typeof current.longitude !== "number") return true;
  return Math.abs(current.latitude - next.latitude) > 0.00001 || Math.abs(current.longitude - next.longitude) > 0.00001;
}

/**
 * The changes Settings sends for a clinic (`{ name?, address? + location?, phone? }`),
 * kept only where they differ from the clinic as it is. An address is kept when its
 * text differs, or when only its pin was moved.
 */
export function clinicChangesFromBody(
  body: unknown,
  current: { name: string; address: string; phone: string; latitude?: number | null; longitude?: number | null },
): Checked<{ changes: ClinicDetailsChanges }> {
  const raw = (body ?? {}) as Record<string, unknown>;
  const changes: ClinicDetailsChanges = {};
  if (raw.name !== undefined) {
    const name = clean(raw.name);
    const nameError = checkName(name);
    if (nameError) return { ok: false, message: nameError };
    if (name !== clean(current.name)) changes.name = name;
  }
  if (raw.address !== undefined) {
    const address = clean(raw.address);
    const place = placeFrom(raw.location);
    if (!address || !place) return { ok: false, message: "Pick the address from the suggestions or drop a pin." };
    if (address !== clean(current.address) || clinicPinMoved(current, place)) {
      changes.address = address;
      changes.location = place;
    }
  }
  if (raw.phone !== undefined) {
    const phone = normalizeCyprusClinicPhone(clean(raw.phone));
    if (!phone) return { ok: false, message: PHONE_MESSAGE };
    if (phone !== (normalizeCyprusClinicPhone(current.phone) ?? current.phone.replace(/\D/g, ""))) changes.phone = phone;
  }
  if (Object.keys(changes).length === 0) return { ok: false, message: "Change at least one detail." };
  return { ok: true, changes };
}

export type ClinicChangeLine = { label: "Name" | "Address" | "Map pin" | "Phone"; from: string; to: string };

const phoneShown = (phone: string | null | undefined): string => {
  const value = String(phone ?? "").trim();
  return value ? formatCyprusPhoneDisplay(value) : "none";
};

/** "What you are asking for": one line per detail that changes, old → new. */
export function clinicChangeLines(
  current: { name: string; address: string; phone: string },
  changes: { name?: string; address?: string; phone?: string },
): ClinicChangeLine[] {
  const lines: ClinicChangeLine[] = [];
  if (changes.name) lines.push({ label: "Name", from: current.name || "none", to: changes.name });
  if (changes.address && changes.address === clean(current.address)) {
    // Same address, so only its pin was moved.
    lines.push({ label: "Map pin", from: "where it is now", to: "moved to a new spot" });
  } else if (changes.address) {
    lines.push({ label: "Address", from: current.address || "none", to: changes.address });
  }
  if (changes.phone) lines.push({ label: "Phone", from: phoneShown(current.phone), to: phoneShown(changes.phone) });
  return lines;
}

export type ClinicRequestRow = {
  id: string;
  request_type: string;
  status: string;
  details: unknown;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
};

export type PendingClinicAddRequest = { id: string; createdAt: string; name: string; address: string };
export type PendingClinicDetailsRequest = {
  id: string;
  createdAt: string;
  changes: { name?: string; address?: string; phone?: string };
};
export type DeniedClinicRequest = { id: string; decidedAt: string; reason: string; name: string | null };

export type ClinicRequestStates = {
  /** Her new-clinic request: the one waiting, or her latest denial. */
  add: { pending: PendingClinicAddRequest | null; denied: DeniedClinicRequest | null };
  /** By clinic id (`clinics.id`): her open details request, or her latest denial. */
  details: Record<string, { pending: PendingClinicDetailsRequest | null; denied: DeniedClinicRequest | null }>;
};

const detailsOf = (row: ClinicRequestRow) => (row.details ?? {}) as Record<string, unknown>;
const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function deniedFrom(row: ClinicRequestRow, name: string | null): DeniedClinicRequest {
  return { id: row.id, decidedAt: row.decided_at ?? row.created_at, reason: row.decision_note ?? "", name };
}

/** What Settings shows: for each kind (and clinic), her latest request when it is open or was denied. */
export function clinicRequestStates(rows: readonly ClinicRequestRow[]): ClinicRequestStates {
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const states: ClinicRequestStates = { add: { pending: null, denied: null }, details: {} };

  const latestAdd = sorted.find((row) => row.request_type === CLINIC_ADD_REQUEST_TYPE);
  if (latestAdd?.status === "pending") {
    const details = detailsOf(latestAdd);
    states.add.pending = {
      id: latestAdd.id,
      createdAt: latestAdd.created_at,
      name: textOf(details.name),
      address: textOf(details.address),
    };
  } else if (latestAdd?.status === "rejected") {
    states.add.denied = deniedFrom(latestAdd, textOf(detailsOf(latestAdd).name) || null);
  }

  const seen = new Set<string>();
  for (const row of sorted) {
    if (row.request_type !== CLINIC_DETAILS_REQUEST_TYPE) continue;
    const details = detailsOf(row);
    const clinicId = textOf(details.clinic_id);
    if (!clinicId || seen.has(clinicId)) continue;
    seen.add(clinicId);
    const changes = (details.changes ?? {}) as Record<string, unknown>;
    if (row.status === "pending") {
      states.details[clinicId] = {
        pending: {
          id: row.id,
          createdAt: row.created_at,
          changes: {
            ...(textOf(changes.name) ? { name: textOf(changes.name) } : {}),
            ...(textOf(changes.address) ? { address: textOf(changes.address) } : {}),
            ...(textOf(changes.phone) ? { phone: textOf(changes.phone) } : {}),
          },
        },
        denied: null,
      };
    } else if (row.status === "rejected") {
      states.details[clinicId] = { pending: null, denied: deniedFrom(row, null) };
    }
  }
  return states;
}

/**
 * The new clinic a founder approves: as she asked, or with their correction of its
 * name, address text or phone (the pin stays hers). `corrected` is what
 * request_approve records, null when unchanged.
 */
export function reviewedNewClinic(
  asked: NewClinicDetails,
  founder: { name?: unknown; address?: unknown; phone?: unknown },
): Checked<{ details: NewClinicDetails; corrected: NewClinicDetails | null }> {
  const name = founder.name == null ? asked.name : clean(founder.name);
  const address = founder.address == null ? asked.address : clean(founder.address);
  const phone = founder.phone == null ? asked.phone : normalizeCyprusClinicPhone(clean(founder.phone));
  const nameError = checkName(name);
  if (nameError) return { ok: false, message: nameError };
  if (!address) return { ok: false, message: "Enter the clinic address." };
  if (!phone) return { ok: false, message: PHONE_MESSAGE };
  const details = { ...asked, name, address, phone };
  const unchanged = name === asked.name && address === asked.address && phone === asked.phone;
  return { ok: true, details, corrected: unchanged ? null : details };
}

/**
 * The clinic changes a founder approves: hers, or with their correction of the values
 * she asked to change (they cannot add a detail she did not ask about).
 */
export function reviewedClinicChanges(
  asked: ClinicDetailsChanges,
  founder: { name?: unknown; address?: unknown; phone?: unknown },
): Checked<{ changes: ClinicDetailsChanges; corrected: boolean }> {
  const changes: ClinicDetailsChanges = { ...asked };
  if (asked.name !== undefined && founder.name != null) {
    const name = clean(founder.name);
    const nameError = checkName(name);
    if (nameError) return { ok: false, message: nameError };
    changes.name = name;
  }
  if (asked.address !== undefined && founder.address != null) {
    const address = clean(founder.address);
    if (!address) return { ok: false, message: "Enter the clinic address." };
    changes.address = address;
  }
  if (asked.phone !== undefined && founder.phone != null) {
    const phone = normalizeCyprusClinicPhone(clean(founder.phone));
    if (!phone) return { ok: false, message: PHONE_MESSAGE };
    changes.phone = phone;
  }
  const corrected =
    changes.name !== asked.name || changes.address !== asked.address || changes.phone !== asked.phone;
  return { ok: true, changes, corrected };
}

/** A database refusal in plain words, for her ("submit", "withdraw") or the founder ("decide"). */
export function clinicRequestDbErrorMessage(
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null },
  action: "submit" | "withdraw" | "decide",
): { status: number; message: string } {
  const code = error.code ?? "";
  const text = error.message ?? "";
  if (action === "submit") {
    // Sent too often (request_types limits): she is told when she can send another.
    const tooOften = tooOftenRefusal(error);
    if (tooOften) return tooOften;
    if (code === "23505") {
      return { status: 409, message: "You already have a request waiting. Withdraw it to send a new one." };
    }
    if (code === "23514") return { status: 409, message: "You can have up to 5 clinics. Leave one to add another." };
    if (code === "P0002") return { status: 404, message: "That clinic is not on your profile." };
    if (code === "22023") return { status: 400, message: "That request could not be sent. Check it and try again." };
    return { status: 500, message: "Could not send the request. Please try again." };
  }
  if (action === "withdraw") {
    if (code === "55000") {
      return { status: 409, message: "DocCy has already decided this request. Reload the page to see the result." };
    }
    return { status: 500, message: "Could not withdraw the request. Please try again." };
  }
  if (code === "42501") return { status: 403, message: "Only founders can decide requests." };
  if (code === "P0002") {
    return /clinic .* not found/.test(text)
      ? { status: 404, message: "That DocCy clinic does not exist (or is archived)." }
      : { status: 404, message: "That request, its professional or its clinic no longer exists." };
  }
  if (code === "55000" && /already has 5 clinics/.test(text)) {
    return { status: 409, message: "This professional already has 5 clinics. Deny the request." };
  }
  if (code === "55000" && /already works at this clinic/.test(text)) {
    return { status: 409, message: "This professional already works at that clinic. Deny the request." };
  }
  if (code === "55000" && /no longer works at this clinic/.test(text)) {
    return { status: 409, message: "This professional has left the clinic. Deny the request." };
  }
  if (code === "55000" && /clinic changed since/.test(text)) {
    return {
      status: 409,
      message: "The clinic changed since this request was made. Deny it and ask for a new request.",
    };
  }
  if (code === "55000") return { status: 409, message: "This request was already decided or withdrawn. Reload the page." };
  if (code === "23505") return { status: 409, message: "A clinic with that web address was just created. Try approving again." };
  if (code === "22023" || code === "23514") {
    return { status: 400, message: "Those clinic details cannot be saved. Check the name, address and phone." };
  }
  return { status: 500, message: "Could not save the decision. Please try again." };
}
