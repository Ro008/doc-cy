import type { CyprusDistrict } from "@/lib/cyprus-districts";
import { isCyprusDistrict } from "@/lib/cyprus-districts";
import { matchesAutomatedDoctorRegistrationTestEmailForAdminBypass } from "@/lib/e2e-doctor-registration-test";
import { isTestDoctorRegistrationEmail } from "@/lib/doctor-test-profile";
import {
  clinicLocationFromParts,
  hasConfirmedClinicCoordinates,
  type ClinicLocation,
} from "@/lib/clinic-location";
import {
  fallbackDistrictCoordinates,
  parseOptionalCoordinates,
} from "@/lib/finder-distance";

export type ResolvedRegisterClinicLocation = {
  clinicAddress: string;
  district: CyprusDistrict;
  town: string | null;
  latitude: number;
  longitude: number;
  clinicPlaceId: string | null;
};

export function shouldAllowRegisterClinicE2eFallback(email: string): boolean {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return (
    isTestDoctorRegistrationEmail(normalized) ||
    matchesAutomatedDoctorRegistrationTestEmailForAdminBypass(normalized)
  );
}

export function resolveRegisterClinicLocation(input: {
  clinicAddress: unknown;
  clinicLatitude: unknown;
  clinicLongitude: unknown;
  clinicPlaceId: unknown;
  district: unknown;
  town?: unknown;
  allowE2eFallback: boolean;
}):
  | { ok: true; value: ResolvedRegisterClinicLocation }
  | { ok: false; code: "clinic_address" | "district" } {
  const clinicAddress = String(input.clinicAddress ?? "").trim();
  const districtRaw = String(input.district ?? "").trim();
  const location = clinicLocationFromParts({
    address: clinicAddress,
    latitude: input.clinicLatitude,
    longitude: input.clinicLongitude,
    placeId: String(input.clinicPlaceId ?? "").trim() || null,
    district: districtRaw,
    town: String(input.town ?? "").trim() || null,
  });

  if (!clinicAddress) {
    return { ok: false, code: "clinic_address" };
  }

  if (hasConfirmedClinicCoordinates(location)) {
    const district = location.district ?? (isCyprusDistrict(districtRaw) ? districtRaw : null);
    if (!district) {
      return { ok: false, code: "district" };
    }
    return {
      ok: true,
      value: {
        clinicAddress: location.address,
        district,
        town: location.town,
        latitude: location.latitude as number,
        longitude: location.longitude as number,
        clinicPlaceId: location.placeId,
      },
    };
  }

  if (
    input.allowE2eFallback &&
    isCyprusDistrict(districtRaw) &&
    clinicAddress.length > 0
  ) {
    const center = fallbackDistrictCoordinates(districtRaw);
    return {
      ok: true,
      value: {
        clinicAddress,
        district: districtRaw,
        town: location.town,
        latitude: center.latitude,
        longitude: center.longitude,
        clinicPlaceId: null,
      },
    };
  }

  return { ok: false, code: "clinic_address" };
}

/**
 * Mirrors what `resolveRegisterClinicLocation` accepts on the server: coordinates
 * alone are not enough, since a submit without an address or district is rejected
 * there and the doctor would only see a generic error.
 */
export function registerClinicLocationIsComplete(location: ClinicLocation): boolean {
  return (
    location.address.trim().length > 0 &&
    Boolean(location.district) &&
    hasConfirmedClinicCoordinates(location)
  );
}

export function registerClinicInputNames(index: number): {
  address: string;
  latitude: string;
  longitude: string;
  placeId: string;
  district: string;
  town: string;
  confirmed: string;
} {
  if (index <= 0) {
    return {
      address: "clinicAddress",
      latitude: "clinicLatitude",
      longitude: "clinicLongitude",
      placeId: "clinicPlaceId",
      district: "district",
      town: "town",
      confirmed: "clinicConfirmed",
    };
  }
  return {
    address: `clinic${index}Address`,
    latitude: `clinic${index}Latitude`,
    longitude: `clinic${index}Longitude`,
    placeId: `clinic${index}PlaceId`,
    district: `clinic${index}District`,
    town: `clinic${index}Town`,
    confirmed: `clinic${index}Confirmed`,
  };
}

export function readRegisterClinicsFromFormData(
  formData: FormData,
  allowE2eFallback: boolean,
  maxClinics: number,
):
  | { ok: true; value: ResolvedRegisterClinicLocation[] }
  | { ok: false; code: "clinic_address" | "district" } {
  const clinics: ResolvedRegisterClinicLocation[] = [];
  const limit = Math.max(1, maxClinics);
  for (let index = 0; index < limit; index += 1) {
    const names = registerClinicInputNames(index);
    const address = String(formData.get(names.address) ?? "").trim();
    if (!address) {
      if (index === 0) return { ok: false, code: "clinic_address" };
      break;
    }
    const resolved = resolveRegisterClinicLocation({
      clinicAddress: formData.get(names.address),
      clinicLatitude: formData.get(names.latitude),
      clinicLongitude: formData.get(names.longitude),
      clinicPlaceId: formData.get(names.placeId),
      district: formData.get(names.district),
      town: formData.get(names.town),
      allowE2eFallback,
    });
    if (!resolved.ok) {
      if (index === 0) return resolved;
      break;
    }
    clinics.push(resolved.value);
  }
  if (clinics.length === 0) return { ok: false, code: "clinic_address" };
  return { ok: true, value: clinics };
}

export function readClinicLocationLatitude(location: ClinicLocation): string {
  const coords = parseOptionalCoordinates(location.latitude, location.longitude);
  return coords ? String(coords.latitude) : "";
}
