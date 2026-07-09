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
        latitude: center.latitude,
        longitude: center.longitude,
        clinicPlaceId: null,
      },
    };
  }

  return { ok: false, code: "clinic_address" };
}

export function registerClinicLocationIsComplete(location: ClinicLocation): boolean {
  return hasConfirmedClinicCoordinates(location);
}

export function readClinicLocationLatitude(location: ClinicLocation): string {
  const coords = parseOptionalCoordinates(location.latitude, location.longitude);
  return coords ? String(coords.latitude) : "";
}
