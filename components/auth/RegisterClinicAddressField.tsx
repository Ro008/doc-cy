"use client";

import * as React from "react";
import { ClinicAddressSearchInput } from "@/components/clinic/ClinicAddressSearchInput";
import {
  emptyClinicLocation,
  hasConfirmedClinicCoordinates,
  type ClinicLocation,
} from "@/lib/clinic-location";
import {
  readClinicLocationLatitude,
  registerClinicLocationIsComplete,
} from "@/lib/register-clinic-location";
import {
  registerFieldErrorClass,
  registerHelperClass,
  registerLabelClass,
} from "@/lib/register-ui";

export function RegisterClinicAddressField() {
  const [location, setLocation] = React.useState<ClinicLocation>(emptyClinicLocation());
  const [isEditing, setIsEditing] = React.useState(true);
  const [searchSession, setSearchSession] = React.useState(0);

  const isComplete = registerClinicLocationIsComplete(location);

  return (
    <div className="group sm:col-span-2" data-validate-field="1" data-invalid="0">
      <span className={registerLabelClass}>
        Clinic address<span className="text-red-600">*</span>
      </span>
      <p className={registerHelperClass}>
        Search your clinic on Google Maps. We use the pinned location for Health Finder distance
        and your public profile.
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
        type="hidden"
        name="clinicConfirmed"
        value={isComplete ? "1" : ""}
        required
        data-validity-proxy="true"
        readOnly
        aria-hidden
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

      <p className={registerFieldErrorClass}>
        Please select your clinic from the Google Maps suggestions.
      </p>
    </div>
  );
}
