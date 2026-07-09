"use client";

import * as React from "react";
import { loadGoogleMapsPlaces } from "@/lib/google-maps-loader";
import {
  inferCyprusDistrictFromClinic,
  type ClinicLocation,
} from "@/lib/clinic-location";
import { registerHelperClass, registerInputClass } from "@/lib/register-ui";

type Tone = "dark" | "light";

type Props = {
  id: string;
  tone?: Tone;
  onChange: (value: ClinicLocation) => void;
  onCancel?: () => void;
  placeholder?: string;
};

const darkInputClass =
  "mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-clinical-400/60";

const toneStyles: Record<
  Tone,
  {
    input: string;
    helper: string;
    error: string;
    cancel: string;
  }
> = {
  dark: {
    input: darkInputClass,
    helper: "mt-2 text-xs text-slate-400",
    error: "mt-2 text-xs text-amber-200",
    cancel:
      "mt-2 text-xs font-medium text-slate-400 underline underline-offset-2 transition hover:text-slate-200",
  },
  light: {
    input: registerInputClass,
    helper: registerHelperClass,
    error: "mt-1 text-xs text-amber-700",
    cancel:
      "mt-2 text-xs font-medium text-clinical-700 underline underline-offset-2 transition hover:text-clinical-600",
  },
};

export function ClinicAddressSearchInput({
  id,
  tone = "dark",
  onChange,
  onCancel,
  placeholder = "Search your clinic on Google Maps",
}: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const onChangeRef = React.useRef(onChange);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const styles = toneStyles[tone];

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
        placeholder={placeholder}
        autoComplete="off"
        aria-label="Clinic address"
        className={styles.input}
      />
      {loadError ? (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      ) : isReady ? (
        <p className={styles.helper}>
          Start typing and choose your clinic from Google suggestions.
        </p>
      ) : (
        <p className={styles.helper}>Loading clinic search…</p>
      )}
      {onCancel ? (
        <button type="button" onClick={onCancel} className={styles.cancel}>
          Cancel
        </button>
      ) : null}
    </div>
  );
}
