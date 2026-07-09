"use client";

import * as React from "react";
import { loadGoogleMapsPlaces } from "@/lib/google-maps-loader";
import {
  hasConfirmedClinicCoordinates,
  inferCyprusDistrictFromClinic,
  type ClinicLocation,
} from "@/lib/clinic-location";

type Props = {
  id: string;
  value: ClinicLocation;
  onChange: (value: ClinicLocation) => void;
  disabled?: boolean;
};

type SearchInputProps = {
  id: string;
  onChange: (value: ClinicLocation) => void;
  onCancel?: () => void;
};

function ClinicAddressSearchInput({ id, onChange, onCancel }: SearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const onChangeRef = React.useRef(onChange);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    let cancelled = false;
    let listener: google.maps.MapsEventListener | null = null;

    const previousAuthFailure = (
      window as Window & { gm_authFailure?: () => void }
    ).gm_authFailure;

    (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
      if (!cancelled) {
        setLoadError(
          "Google Maps blocked this site. Add http://localhost:3000/* (and your prod domain) to API key website restrictions.",
        );
        setIsReady(false);
      }
      previousAuthFailure?.();
    };

    loadGoogleMapsPlaces()
      .then((maps) => {
        if (cancelled || !inputRef.current) return;

        const autocomplete = new maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "cy" },
          fields: ["formatted_address", "address_components", "geometry", "place_id", "name"],
        });

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const location = place.geometry?.location;
          if (!location) return;

          const formattedAddress =
            place.formatted_address?.trim() ||
            place.name?.trim() ||
            inputRef.current?.value.trim() ||
            "";

          const latitude = location.lat();
          const longitude = location.lng();
          const district = inferCyprusDistrictFromClinic({
            address: formattedAddress,
            latitude,
            longitude,
            addressComponents: place.address_components,
          });

          onChangeRef.current({
            address: formattedAddress,
            latitude,
            longitude,
            placeId: place.place_id?.trim() || null,
            district,
          });
        });

        setIsReady(true);
        setLoadError(null);
        inputRef.current.focus();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Could not load Google Maps autocomplete.";
        setLoadError(message);
        setIsReady(false);
      });

    return () => {
      cancelled = true;
      listener?.remove();
      (window as Window & { gm_authFailure?: () => void }).gm_authFailure = previousAuthFailure;
    };
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        defaultValue=""
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        onChange={(event) => {
          onChangeRef.current({
            address: event.target.value,
            latitude: null,
            longitude: null,
            placeId: null,
            district: null,
          });
        }}
        placeholder="Search your clinic on Google Maps"
        autoComplete="off"
        className="mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
      />
      {loadError ? (
        <p className="mt-2 text-xs text-amber-200" role="alert">
          {loadError}
        </p>
      ) : isReady ? (
        <p className="mt-2 text-xs text-slate-400">
          Start typing and choose your clinic from Google suggestions.
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Loading clinic search…</p>
      )}
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 text-xs font-medium text-slate-400 underline underline-offset-2 transition hover:text-slate-200"
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}

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
