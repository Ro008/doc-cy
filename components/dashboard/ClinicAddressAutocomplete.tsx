"use client";

import * as React from "react";
import { ClinicAddressSearchInput } from "@/components/clinic/ClinicAddressSearchInput";
import {
  hasConfirmedClinicCoordinates,
  type ClinicLocation,
} from "@/lib/clinic-location";

type Props = {
  id: string;
  value: ClinicLocation;
  onChange: (value: ClinicLocation) => void;
  disabled?: boolean;
};

export function ClinicAddressAutocomplete({ id, value, onChange, disabled = false }: Props) {
  const [isEditing, setIsEditing] = React.useState(() => !value.address.trim());
  const [searchSession, setSearchSession] = React.useState(0);
  const savedLocationRef = React.useRef<ClinicLocation>(value);

  React.useEffect(() => {
    if (!isEditing) {
      savedLocationRef.current = value;
    }
    if (!value.address.trim()) {
      setIsEditing(true);
    }
  }, [value, isEditing]);

  const hasSavedAddress = value.address.trim().length > 0;
  const showDerivedDistrict =
    hasSavedAddress && !isEditing && hasConfirmedClinicCoordinates(value) && value.district;

  if (hasSavedAddress && !isEditing) {
    return (
      <div>
        <p className="mt-2 rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm leading-relaxed text-slate-100">
          {value.address}
        </p>
        {showDerivedDistrict ? (
          <p className="mt-2 text-xs text-slate-400">
            District:{" "}
            <span className="font-semibold text-slate-200">{value.district}</span>
          </p>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            savedLocationRef.current = value;
            setSearchSession((current) => current + 1);
            setIsEditing(true);
          }}
          className="mt-2 text-xs font-semibold text-clinical-300 underline underline-offset-2 transition hover:text-clinical-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Change clinic address
        </button>
      </div>
    );
  }

  return (
    <ClinicAddressSearchInput
      key={searchSession}
      id={id}
      tone="dark"
      onChange={(nextValue) => {
        onChange(nextValue);
        if (nextValue.latitude != null && nextValue.longitude != null) {
          setIsEditing(false);
        }
      }}
      onCancel={
        hasSavedAddress
          ? () => {
              onChange(savedLocationRef.current);
              setIsEditing(false);
            }
          : undefined
      }
    />
  );
}
