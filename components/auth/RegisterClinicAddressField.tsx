"use client";

import * as React from "react";
import { Check, MapPin, Move, Search, Undo2 } from "lucide-react";
import { ClinicAddressSearchInput } from "@/components/clinic/ClinicAddressSearchInput";
import { ClinicPinAdjustSheet } from "@/components/clinic/ClinicPinAdjustSheet";
import { ClinicPinMap } from "@/components/clinic/ClinicPinMap";
import {
  clinicLocationFromParts,
  clinicAddressDistrictConflicts,
  clinicLocationWithAddressAlignedDistrict,
  emptyClinicLocation,
  hasConfirmedClinicCoordinates,
  type ClinicLocation,
} from "@/lib/clinic-location";
import {
  reverseGeocodeClinicPin,
  type ReverseGeocodedPin,
} from "@/lib/clinic-reverse-geocode";
import {
  clinicLocationCoordinates,
  clinicLocationWithCoordinates,
  clinicPinAddressConflicts,
  clinicPinFarFromAddress,
  clinicPinMoved,
  manualClinicLocation,
  stripPlusCodePrefix,
} from "@/lib/clinic-location-pin";
import { CYPRUS_DISTRICTS, isCyprusDistrict } from "@/lib/cyprus-districts";
import {
  e2eRegisterHooksEnabled,
  E2E_REGISTER_CLINIC_EVENT,
} from "@/lib/e2e-doctor-registration-test";
import { fallbackDistrictCoordinates, type Coordinates } from "@/lib/finder-distance";
import {
  readClinicLocationLatitude,
  registerClinicInputNames,
  registerClinicLocationIsComplete,
} from "@/lib/register-clinic-location";
import {
  registerFieldErrorClass,
  registerHelperClass,
  registerInputClass,
  registerLabelClass,
} from "@/lib/register-ui";

type Mode = "search" | "adjust" | "manual" | "confirmed";

const linkClass =
  "text-xs font-semibold text-clinical-700 underline underline-offset-2 transition hover:text-clinical-600";

const secondaryButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-clinical-300 hover:text-clinical-700";

const primaryButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg bg-clinical-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-clinical-400 disabled:cursor-not-allowed disabled:opacity-50";

export function RegisterClinicAddressField({
  listingAddressHint,
  initialLocation = null,
  index = 0,
  showAddLaterHint = true,
  heading = null,
}: {
  listingAddressHint?: string | null;
  initialLocation?: ClinicLocation | null;
  index?: number;
  showAddLaterHint?: boolean;
  heading?: string | null;
} = {}) {
  const names = registerClinicInputNames(index);
  const fieldKey = index === 0 ? "clinic" : `clinic${index}`;
  const fieldLabel =
    heading ?? (index === 0 ? "Clinic address" : `Clinic ${index + 1} address`);
  const starting = initialLocation && registerClinicLocationIsComplete(initialLocation)
    ? initialLocation
    : emptyClinicLocation();
  const [location, setLocation] = React.useState<ClinicLocation>(starting);
  const [mode, setMode] = React.useState<Mode>(
    registerClinicLocationIsComplete(starting) ? "confirmed" : "search",
  );
  const [searchSession, setSearchSession] = React.useState(0);
  /** Coordinates before the doctor moved the pin, so Undo can snap back. */
  const [origin, setOrigin] = React.useState<Coordinates | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  /** Where the pin was when the sheet opened, so cancelling restores it. */
  const sheetEntryRef = React.useRef<Coordinates | null>(null);
  /**
   * Raw text of the manual address input. `ClinicLocation.address` is trimmed,
   * so feeding it straight back as the input's value ate every space the moment
   * it was typed and the doctor could never get past the first word.
   */
  const [manualAddressDraft, setManualAddressDraft] = React.useState("");

  React.useEffect(() => {
    if (index !== 0) return;
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
      setOrigin(clinicLocationCoordinates(next));
      setMode("confirmed");
    };

    window.addEventListener(E2E_REGISTER_CLINIC_EVENT, onFill);
    return () => window.removeEventListener(E2E_REGISTER_CLINIC_EVENT, onFill);
  }, [index]);

  const isComplete = registerClinicLocationIsComplete(location);
  const hint = String(listingAddressHint ?? "").trim();
  const coords = clinicLocationCoordinates(location);
  const pinMoved = clinicPinMoved(origin, coords);
  const pinLatitude = coords?.latitude ?? null;
  const pinLongitude = coords?.longitude ?? null;

  /**
   * What Google thinks is under a moved pin. Only relevant on the search path:
   * in manual mode the doctor wrote the address themselves and the pin is
   * theirs, so there is nothing to reconcile.
   */
  const [pinSuggestion, setPinSuggestion] = React.useState<ReverseGeocodedPin | null>(null);
  const [pinLookupFailed, setPinLookupFailed] = React.useState(false);

  const suggestionAddress =
    pinSuggestion && clinicPinAddressConflicts(location.address, pinSuggestion.address)
      ? pinSuggestion.address
      : null;
  /**
   * Warn on a street change, or — when reverse geocoding is unavailable and we
   * cannot compare streets — on a move too long to still be the same address.
   * A short nudge to the right entrance stays silent, since the address the
   * doctor picked is still correct there.
   */
  const showPinMismatch =
    mode === "adjust" &&
    (Boolean(suggestionAddress) ||
      (pinLookupFailed && clinicPinFarFromAddress(origin, coords)));

  React.useEffect(() => {
    if (mode !== "adjust" || !pinMoved || pinLatitude == null || pinLongitude == null) {
      setPinSuggestion(null);
      setPinLookupFailed(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void reverseGeocodeClinicPin({ latitude: pinLatitude, longitude: pinLongitude }).then(
        (result) => {
          if (cancelled) return;
          setPinSuggestion(result);
          setPinLookupFailed(result === null);
        },
      );
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, pinMoved, pinLatitude, pinLongitude]);

  /**
   * Keeps the current location so a doctor who opens the search by mistake can
   * cancel back to it, and so the progress bar does not regress mid-edit.
   */
  const startSearch = () => {
    setSearchSession((current) => current + 1);
    setMode("search");
  };

  const startManual = () => {
    setLocation(emptyClinicLocation());
    setOrigin(null);
    setManualAddressDraft("");
    setMode("manual");
  };

  const handlePinChange = (next: Coordinates) => {
    setLocation((current) =>
      mode === "manual"
        ? manualClinicLocation({
            address: current.address,
            district: current.district,
            coords: next,
          })
        : clinicLocationWithCoordinates(current, next),
    );
  };

  /**
   * Manual mode only: with no Google result to infer from, the district is the
   * doctor's statement and it is also how they tell the map where to open.
   */
  const handleDistrictChange = (value: string) => {
    const district = isCyprusDistrict(value) ? value : null;
    const center = district ? fallbackDistrictCoordinates(district) : null;
    setOrigin(center);
    setLocation((current) =>
      center
        ? manualClinicLocation({ address: current.address, district, coords: center })
        : { ...current, district, latitude: null, longitude: null },
    );
  };

  /** Adopts the address under the pin, which is no longer the place they searched. */
  const acceptPinSuggestion = () => {
    if (!pinSuggestion || !coords) return;
    const address = stripPlusCodePrefix(pinSuggestion.address);
    setLocation(
      clinicLocationWithAddressAlignedDistrict(
        clinicLocationFromParts({
          address,
          latitude: coords.latitude,
          longitude: coords.longitude,
          placeId: null,
          district: null,
          town: null,
          addressComponents: pinSuggestion.addressComponents,
        }),
      ),
    );
    // The pin now matches the address, so it counts as unmoved from here on.
    setOrigin(coords);
    setPinSuggestion(null);
  };

  const addressDistrictConflict = clinicAddressDistrictConflicts(location);
  /** Street conflict or district/address contradiction — do not let them confirm. */
  const cannotConfirm =
    Boolean(suggestionAddress) || showPinMismatch || addressDistrictConflict;

  const confirmLocation = () => {
    setLocation((current) => clinicLocationWithAddressAlignedDistrict(current));
    setMode("confirmed");
  };

  const previewZoom = mode === "manual" ? 14 : 17;

  const openSheet = () => {
    sheetEntryRef.current = coords;
    setSheetOpen(true);
  };

  /**
   * Non-interactive preview plus a button into the sheet. The preview is what
   * makes a wrong Google pin visible at all; before this the doctor only ever
   * saw the address text.
   */
  const mapPreview = coords ? (
    <>
      <ClinicPinMap
        center={coords}
        zoom={previewZoom}
        interactive={false}
        className="mt-2"
        frameClassName="h-40"
        label="Clinic location preview"
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={openSheet} className={secondaryButtonClass}>
          <Move className="h-3.5 w-3.5" aria-hidden />
          Adjust on map
        </button>
        {pinMoved ? (
          <span className="inline-flex items-center gap-2 text-xs text-ink-600">
            Location adjusted
            {origin ? (
              <button
                type="button"
                onClick={() => handlePinChange(origin)}
                className={linkClass}
              >
                <Undo2 className="mr-1 inline h-3 w-3" aria-hidden />
                Undo
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </>
  ) : null;

  const districtSelect = (
    <label className="mt-3 block">
      <span className="text-xs font-medium text-ink-700">District</span>
      <select
        value={location.district ?? ""}
        onChange={(event) => handleDistrictChange(event.target.value)}
        className={registerInputClass}
        aria-label="District"
      >
        <option value="">Select a district</option>
        {CYPRUS_DISTRICTS.map((district) => (
          <option key={district} value={district}>
            {district}
          </option>
        ))}
      </select>
      <span className={registerHelperClass}>
        Patients filter by district, so check this matches your clinic.
      </span>
    </label>
  );

  return (
    <div
      className="group"
      data-validate-field="1"
      data-invalid="0"
      data-field-key={fieldKey}
      data-field-label={fieldLabel}
    >
      <span className={registerLabelClass}>
        {fieldLabel}<span className="text-red-600">*</span>
      </span>
      <p className={registerHelperClass}>
        Pick this clinic from the Google Maps suggestions, then check the pin sits on your
        entrance so patients nearby can find you.
      </p>
      {hint ? (
        <p className={registerHelperClass}>
          Your listing already shows: <span className="font-medium text-ink-700">{hint}</span>.
          Search and confirm the same clinic below.
        </p>
      ) : null}
      {showAddLaterHint ? (
        <p className={registerHelperClass}>
          If you work at more than one clinic, you can add the others later in Settings.
        </p>
      ) : null}

      {mode === "confirmed" && isComplete ? (
        addressDistrictConflict ? (
          <div
            className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5"
            data-testid="clinic-district-mismatch"
          >
            <p className="text-sm leading-relaxed text-ink-900">{location.address}</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              This address does not match district {location.district}. Fix it before continuing.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => {
                  setLocation((current) => clinicLocationWithAddressAlignedDistrict(current));
                }}
                className={linkClass}
              >
                Use the city in the address
              </button>
              <button type="button" onClick={startSearch} className={linkClass}>
                Search again
              </button>
            </div>
          </div>
        ) : (
        <div className="mt-2 rounded-xl border border-ink-200 bg-ink-50/80 px-3 py-2.5">
          <p className="text-sm leading-relaxed text-ink-900">{location.address}</p>
          {location.district ? (
            <p className="mt-1 text-xs text-ink-600">
              District: <span className="font-semibold text-ink-800">{location.district}</span>
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {coords ? (
              <button
                type="button"
                onClick={() => {
                  if (location.placeId) {
                    setMode("adjust");
                    return;
                  }
                  setManualAddressDraft(location.address);
                  setMode("manual");
                }}
                className={linkClass}
              >
                Adjust pin on map
              </button>
            ) : null}
            <button type="button" onClick={startSearch} className={linkClass}>
              Change clinic address
            </button>
          </div>
        </div>
        )
      ) : null}

      {mode === "search" ? (
        <>
          <ClinicAddressSearchInput
            key={searchSession}
            id={index === 0 ? "register-clinic-address" : `register-clinic-address-${index}`}
            tone="light"
            showReadyHint={false}
            onChange={(nextValue) => {
              // Address text wins over a wrong component/centroid district, so a
              // Nicosia street never lands under Paphos from a Google quirk.
              const aligned = clinicLocationWithAddressAlignedDistrict(nextValue);
              setLocation(aligned);
              if (hasConfirmedClinicCoordinates(aligned)) {
                setOrigin(clinicLocationCoordinates(aligned));
                setMode("adjust");
              }
            }}
            onCancel={isComplete ? () => setMode("confirmed") : undefined}
          />
          <p className={registerHelperClass}>
            Can&rsquo;t find your clinic?{" "}
            <button type="button" onClick={startManual} className={linkClass}>
              Place it on the map yourself
            </button>
          </p>
        </>
      ) : null}

      {mode === "adjust" && coords ? (
        <div className="mt-2 rounded-xl border border-ink-200 bg-white p-3">
          <p className="flex items-start gap-1.5 text-sm leading-relaxed text-ink-900">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-clinical-600" aria-hidden />
            {location.address}
          </p>

          {mapPreview}

          {/* Offered, not asserted. Google returns Cyprus streets in Greek or in
              Latin depending on the point, so a difference here does not prove
              the doctor's address is wrong — it is their call. */}
          {suggestionAddress ? (
            <div
              className="mt-2 rounded-lg border border-clinical-200 bg-clinical-50/60 px-3 py-2"
              data-testid="clinic-pin-suggestion"
            >
              <p className="text-xs leading-relaxed text-ink-700">
                Google reads the pin as{" "}
                <span className="font-semibold text-ink-900">{suggestionAddress}</span>
              </p>
              <button
                type="button"
                onClick={acceptPinSuggestion}
                className={`mt-2 ${secondaryButtonClass}`}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Use this address instead
              </button>
            </div>
          ) : showPinMismatch ? (
            <div
              className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2"
              data-testid="clinic-pin-mismatch"
            >
              <p className="text-xs leading-relaxed text-amber-900">
                The pin is a long way from the address above. Undo it, or search for the clinic
                again with the right street.
              </p>
            </div>
          ) : null}

          {pinMoved && !suggestionAddress && !showPinMismatch ? (
            // Without this, a doctor who moves the pin and still reads the old
            // street assumes the move was ignored.
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              The address text stays as you picked it — that is what patients read. The pin only
              sets where you appear in &ldquo;near me&rdquo; searches.
            </p>
          ) : null}

          {/* Read-only on purpose. Letting the doctor override this produced
              records like a Paphos address filed under Limassol; if the district
              is wrong, the address is wrong and they should search again. */}
          {location.district ? (
            <p className="mt-3 text-xs text-ink-600">
              District: <span className="font-semibold text-ink-800">{location.district}</span>
            </p>
          ) : null}

          {addressDistrictConflict ? (
            <div
              className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2"
              data-testid="clinic-district-mismatch"
            >
              <p className="text-xs leading-relaxed text-amber-900">
                The address says{" "}
                <span className="font-semibold">
                  {location.address.match(/Nicosia|Limassol|Paphos|Pafos|Larnaca|Famagusta/i)?.[0] ??
                    "a different city"}
                </span>
                , but the district is set to {location.district}. Search again for the right
                clinic, or place it on the map yourself.
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={confirmLocation}
              disabled={!isComplete || cannotConfirm}
              className={primaryButtonClass}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Looks right
            </button>
            <button type="button" onClick={startSearch} className={secondaryButtonClass}>
              <Search className="h-3.5 w-3.5" aria-hidden />
              Search a different clinic
            </button>
          </div>
        </div>
      ) : null}

      {mode === "manual" ? (
        <div className="mt-2 rounded-xl border border-ink-200 bg-white p-3">
          <p className="text-xs leading-relaxed text-ink-600">
            Choose your district, then move the map so the pin sits on your clinic.
          </p>

          {districtSelect}

          {coords ? (
            <>
              {mapPreview}

              <label className="mt-3 block">
                <span className="text-xs font-medium text-ink-700">Street address</span>
                <input
                  type="text"
                  value={manualAddressDraft}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setManualAddressDraft(raw);
                    setLocation((current) =>
                      manualClinicLocation({
                        address: raw,
                        district: current.district,
                        coords: clinicLocationCoordinates(current) ?? coords,
                      }),
                    );
                  }}
                  placeholder="Street and number, building, floor"
                  autoComplete="street-address"
                  className={registerInputClass}
                />
                <span className={registerHelperClass}>
                  This is what patients see on your profile.
                </span>
              </label>
            </>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("confirmed")}
              disabled={!isComplete}
              className={primaryButtonClass}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Save this location
            </button>
            <button type="button" onClick={startSearch} className={secondaryButtonClass}>
              <Search className="h-3.5 w-3.5" aria-hidden />
              Back to search
            </button>
          </div>
        </div>
      ) : null}

      {sheetOpen && coords ? (
        <ClinicPinAdjustSheet
          center={coords}
          onCenterChange={handlePinChange}
          origin={origin}
          zoom={previewZoom}
          address={location.address || undefined}
          onClose={() => setSheetOpen(false)}
          onCancel={() => {
            const entry = sheetEntryRef.current;
            if (entry) handlePinChange(entry);
          }}
        />
      ) : null}

      <input
        type="text"
        name={names.confirmed}
        value={isComplete && !addressDistrictConflict ? "1" : ""}
        required
        data-validity-proxy="true"
        // A readonly input is barred from constraint validation, which would make
        // this required field silently always valid. The no-op keeps React quiet.
        onChange={() => {}}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <input type="hidden" name={names.address} value={location.address} readOnly aria-hidden />
      <input
        type="hidden"
        name={names.latitude}
        value={readClinicLocationLatitude(location)}
        readOnly
        aria-hidden
      />
      <input
        type="hidden"
        name={names.longitude}
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
        name={names.placeId}
        value={location.placeId ?? ""}
        readOnly
        aria-hidden
      />
      <input type="hidden" name={names.district} value={location.district ?? ""} readOnly aria-hidden />
      <input type="hidden" name={names.town} value={location.town ?? ""} readOnly aria-hidden />

      <p className={registerFieldErrorClass}>
        Search for your clinic, or place it on the map yourself.
      </p>
    </div>
  );
}
