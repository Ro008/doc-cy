"use client";

import * as React from "react";
import { ClinicAddressSearchInput } from "@/components/clinic/ClinicAddressSearchInput";
import {
  emptyClinicLocation,
  hasConfirmedClinicCoordinates,
  type ClinicLocation,
} from "@/lib/clinic-location";
import {
  e2eRegisterHooksEnabled,
  E2E_REGISTER_CLINIC_EVENT,
} from "@/lib/e2e-doctor-registration-test";
import {
  readClinicLocationLatitude,
  registerClinicLocationIsComplete,
} from "@/lib/register-clinic-location";
import {
  registerFieldErrorClass,
  registerHelperClass,
  registerLabelClass,
} from "@/lib/register-ui";

export function RegisterClinicAddressField({
  listingAddressHint,
}: {
  listingAddressHint?: string | null;
} = {}) {
  const [location, setLocation] = React.useState<ClinicLocation>(emptyClinicLocation());
  const [isEditing, setIsEditing] = React.useState(true);
  const [searchSession, setSearchSession] = React.useState(0);

  React.useEffect(() => {
    if (!e2eRegisterHooksEnabled()) return;

    const onFill = (event: Event) => {
      const detail = (event as CustomEvent<Partial<ClinicLocation>>).detail;
      if (!detail || typeof detail !== "object") return;
      const next: ClinicLocation = {
        address: String(detail.address ?? "").trim(),
        latitude: typeof detail.latitude === "number" ? detail.latitude : null,
        longitude: typeof detail.longitude === "number" ? detail.longitude : null,
        placeId: String(detail.placeId ?? "").trim() || null,
        district: detail.district ?? null,
        town: String(detail.town ?? "").trim() || null,
      };
      if (!hasConfirmedClinicCoordinates(next) || !next.address || !next.district) return;
      setLocation(next);
      setIsEditing(false);
    };

    window.addEventListener(E2E_REGISTER_CLINIC_EVENT, onFill);
    return () => window.removeEventListener(E2E_REGISTER_CLINIC_EVENT, onFill);
  }, []);

  const isComplete = registerClinicLocationIsComplete(location);
  const hint = String(listingAddressHint ?? "").trim();

  return (
    <div
      className="group"
      data-validate-field="1"
      data-invalid="0"
      data-field-key="clinic"
      data-field-label="Clinic address"
    >
      <span className={registerLabelClass}>
        Clinic address<span className="text-red-600">*</span>
      </span>
      <p className={registerHelperClass}>
        Pick your main clinic from the Google Maps suggestions so patients can find you nearby.
      </p>
      {hint ? (
        <p className={registerHelperClass}>
          Your listing already shows: <span className="font-medium text-ink-700">{hint}</span>.
          Search and confirm the same clinic below.
        </p>
      ) : null}
      <p className={registerHelperClass}>
        If you work at more than one clinic, you can add the others later in Settings.
      </p>

      {isComplete && !isEditing ? (
        <div className="mt-2 rounded-xl border border-ink-200 bg-ink-50/80 px-3 py-2.5">
          <p className="text-sm leading-relaxed text-ink-900">{location.address}</p>
          {location.district ? (
            <p className="mt-1 text-xs text-ink-600">
              District: <span className="font-semibold text-ink-800">{location.district}</span>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setSearchSession((current) => current + 1);
              setIsEditing(true);
            }}
            className="mt-2 text-xs font-semibold text-clinical-700 underline underline-offset-2 transition hover:text-clinical-600"
          >
            Change clinic address
          </button>
        </div>
      ) : (
        <ClinicAddressSearchInput
          key={searchSession}
          id="register-clinic-address"
          tone="light"
          showReadyHint={false}
          onChange={(nextValue) => {
            setLocation(nextValue);
            if (hasConfirmedClinicCoordinates(nextValue)) {
              setIsEditing(false);
            }
          }}
          onCancel={
            isComplete
              ? () => {
                  setIsEditing(false);
                }
              : undefined
          }
        />
      )}

      <input
        type="text"
        name="clinicConfirmed"
        value={isComplete ? "1" : ""}
        required
        data-validity-proxy="true"
        // A readonly input is barred from constraint validation, which would make
        // this required field silently always valid. The no-op keeps React quiet.
        onChange={() => {}}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <input type="hidden" name="clinicAddress" value={location.address} readOnly aria-hidden />
      <input
        type="hidden"
        name="clinicLatitude"
        value={readClinicLocationLatitude(location)}
        readOnly
        aria-hidden
      />
      <input
        type="hidden"
        name="clinicLongitude"
        value={
          location.longitude != null && location.latitude != null
            ? String(location.longitude)
            : ""
        }
        readOnly
        aria-hidden
      />
      <input
        type="hidden"
        name="clinicPlaceId"
        value={location.placeId ?? ""}
        readOnly
        aria-hidden
      />
      <input type="hidden" name="district" value={location.district ?? ""} readOnly aria-hidden />
      <input type="hidden" name="town" value={location.town ?? ""} readOnly aria-hidden />

      <p className={registerFieldErrorClass}>
        Please select your clinic from the Google Maps suggestions.
      </p>
    </div>
  );
}
