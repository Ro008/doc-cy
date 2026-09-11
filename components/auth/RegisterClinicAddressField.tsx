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
type Tone = "light" | "dark";

const primaryButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg bg-clinical-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-clinical-400 disabled:cursor-not-allowed disabled:opacity-50";

const darkInputClass =
  "mt-2 w-full rounded-xl border border-slate-800/80 bg-ink-900/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-clinical-400/60";

const toneStyles: Record<
  Tone,
  {
    link: string;
    secondaryButton: string;
    panel: string;
    summaryPanel: string;
    eyebrow: string;
    body: string;
    muted: string;
    soft: string;
    label: string;
    helper: string;
    input: string;
    pinIcon: string;
    adjusted: string;
    stepStrong: string;
    stepDot: string;
    stepMuted: string;
    emphasis: string;
    quiet: string;
    listingHint: string;
    badgeGoogle: string;
    badgePin: string;
    badgeSaved: string;
    clinicalNotice: string;
    clinicalNoticeText: string;
    clinicalNoticeStrong: string;
    amberNotice: string;
    amberNoticeText: string;
    amberHint: string;
    streetError: string;
  }
> = {
  light: {
    link: "text-xs font-semibold text-clinical-700 underline underline-offset-2 transition hover:text-clinical-600",
    secondaryButton:
      "inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-clinical-300 hover:text-clinical-700",
    panel: "mt-2 rounded-xl border border-ink-200 bg-white p-3",
    summaryPanel: "mt-2 rounded-xl border border-ink-200 bg-ink-50/80 px-3 py-2.5",
    eyebrow: "text-[11px] font-semibold uppercase tracking-wide text-ink-500",
    body: "text-sm leading-relaxed text-ink-900",
    muted: "text-xs text-ink-600",
    soft: "text-xs leading-relaxed text-ink-500",
    label: "text-xs font-medium text-ink-700",
    helper: registerHelperClass,
    input: registerInputClass,
    pinIcon: "mt-0.5 h-4 w-4 shrink-0 text-clinical-600",
    adjusted: "inline-flex items-center gap-2 text-xs text-ink-600",
    stepStrong: "font-semibold text-ink-800",
    stepDot: "text-ink-400",
    stepMuted: "text-xs leading-relaxed text-ink-600",
    emphasis: "font-semibold text-ink-800",
    quiet: "text-ink-500",
    listingHint: "font-medium text-ink-700",
    badgeGoogle: "bg-clinical-500/15 text-clinical-800",
    badgePin: "bg-amber-500/15 text-amber-900",
    badgeSaved: "bg-ink-500/10 text-ink-700",
    clinicalNotice: "mt-2 rounded-lg border border-clinical-200 bg-clinical-50/60 px-3 py-2",
    clinicalNoticeText: "text-xs leading-relaxed text-ink-700",
    clinicalNoticeStrong: "font-semibold text-ink-900",
    amberNotice: "mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2",
    amberNoticeText: "text-xs leading-relaxed text-amber-900",
    amberHint: "mt-2 text-xs leading-relaxed text-amber-900",
    streetError: "mt-1 block text-xs text-red-600",
  },
  dark: {
    link: "text-xs font-semibold text-clinical-300 underline underline-offset-2 transition hover:text-clinical-200",
    secondaryButton:
      "inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-950/50 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:text-white",
    panel: "mt-2 rounded-xl border border-slate-700/80 bg-ink-900/40 p-3",
    summaryPanel: "mt-2 rounded-xl border border-slate-700/80 bg-slate-950/50 px-3 py-2.5",
    eyebrow: "text-[11px] font-semibold uppercase tracking-wide text-slate-400",
    body: "text-sm leading-relaxed text-slate-100",
    muted: "text-xs text-slate-400",
    soft: "text-xs leading-relaxed text-slate-400",
    label: "text-xs font-medium text-slate-300",
    helper: "mt-1 block text-xs text-slate-400",
    input: darkInputClass,
    pinIcon: "mt-0.5 h-4 w-4 shrink-0 text-clinical-300",
    adjusted: "inline-flex items-center gap-2 text-xs text-slate-400",
    stepStrong: "font-semibold text-slate-100",
    stepDot: "text-slate-500",
    stepMuted: "text-xs leading-relaxed text-slate-400",
    emphasis: "font-semibold text-slate-200",
    quiet: "text-slate-500",
    listingHint: "font-medium text-slate-200",
    badgeGoogle: "bg-clinical-500/20 text-clinical-200",
    badgePin: "bg-amber-500/20 text-amber-100",
    badgeSaved: "bg-slate-500/20 text-slate-300",
    clinicalNotice: "mt-2 rounded-lg border border-clinical-500/35 bg-clinical-500/10 px-3 py-2",
    clinicalNoticeText: "text-xs leading-relaxed text-slate-300",
    clinicalNoticeStrong: "font-semibold text-slate-100",
    amberNotice: "mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2",
    amberNoticeText: "text-xs leading-relaxed text-amber-100",
    amberHint: "mt-2 text-xs leading-relaxed text-amber-100",
    streetError: "mt-1 block text-xs text-red-400",
  },
};

export function RegisterClinicAddressField({
  listingAddressHint,
  listingDistrict = null,
  initialLocation = null,
  index = 0,
  showAddLaterHint = true,
  heading = null,
  onLocationChange,
  includeHiddenInputs = true,
  hideIntro = false,
  inputId,
  tone = "light",
}: {
  listingAddressHint?: string | null;
  /** District from the finder listing — used when confirming the listing address. */
  listingDistrict?: string | null;
  initialLocation?: ClinicLocation | null;
  index?: number;
  showAddLaterHint?: boolean;
  heading?: string | null;
  /** When set, parent owns persistence (Settings); wizard still keeps local UI state. */
  onLocationChange?: (location: ClinicLocation) => void;
  /** Registration uses hidden inputs for form POST; Settings saves via fetch. */
  includeHiddenInputs?: boolean;
  /** Settings already shows section copy — skip wizard label/helpers. */
  hideIntro?: boolean;
  inputId?: string;
  /** Settings uses dark chrome; registration keeps the light wizard. */
  tone?: Tone;
} = {}) {
  const styles = toneStyles[tone];
  const linkClass = styles.link;
  const secondaryButtonClass = styles.secondaryButton;
  const names = registerClinicInputNames(index);
  const fieldKey = index === 0 ? "clinic" : `clinic${index}`;
  const fieldLabel =
    heading ?? (index === 0 ? "Clinic address" : `Clinic ${index + 1} address`);
  const starting = initialLocation && String(initialLocation.address ?? "").trim()
    ? initialLocation
    : emptyClinicLocation();
  const [location, setLocationState] = React.useState<ClinicLocation>(starting);
  const onLocationChangeRef = React.useRef(onLocationChange);
  React.useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);
  const skipLocationNotifyRef = React.useRef(true);
  React.useEffect(() => {
    if (skipLocationNotifyRef.current) {
      skipLocationNotifyRef.current = false;
      return;
    }
    onLocationChangeRef.current?.(location);
  }, [location]);
  const setLocation = React.useCallback(
    (next: ClinicLocation | ((prev: ClinicLocation) => ClinicLocation)) => {
      setLocationState((prev) => (typeof next === "function" ? next(prev) : next));
    },
    [],
  );
  const [mode, setMode] = React.useState<Mode>(() =>
    // Address text alone is enough to show the saved summary. Requiring coords
    // here hid legacy settings rows (address, no lat/lng) behind an empty search.
    starting.address.trim() ? "confirmed" : "search",
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
  const streetInputRef = React.useRef<HTMLInputElement | null>(null);
  const [streetError, setStreetError] = React.useState(false);
  /** Once the doctor types, reverse-geocode may suggest but must not overwrite. */
  const [streetTouched, setStreetTouched] = React.useState(false);
  const autoPrefillCoordsKeyRef = React.useRef<string | null>(null);
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
   * What Google thinks is under a moved pin.
   * - Adjust (Places): offer a street change when it conflicts with the search.
   * - Manual: prefill an empty street, or offer a replacement if they typed one.
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
    const shouldLookup =
      pinMoved &&
      pinLatitude != null &&
      pinLongitude != null &&
      (mode === "adjust" || mode === "manual");
    if (!shouldLookup) {
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

          if (mode !== "manual" || !result || streetTouched) return;
          const coordsKey = `${pinLatitude.toFixed(5)},${pinLongitude.toFixed(5)}`;
          if (autoPrefillCoordsKeyRef.current === coordsKey) return;

          const address = stripPlusCodePrefix(result.address);
          setManualAddressDraft((current) => (current.trim() ? current : address));
          setLocation((current) => {
            if (current.address.trim()) return current;
            autoPrefillCoordsKeyRef.current = coordsKey;
            return manualClinicLocation({
              address,
              district: current.district,
              coords: { latitude: pinLatitude, longitude: pinLongitude },
            });
          });
          setStreetError(false);
        },
      );
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, pinMoved, pinLatitude, pinLongitude, streetTouched]);

  /**
   * Keeps the current location so a doctor who opens the search by mistake can
   * cancel back to it, and so the progress bar does not regress mid-edit.
   */
  const startSearch = () => {
    setSearchSession((current) => current + 1);
    setMode("search");
  };

  const confirmListingAddress = () => {
    const address = hint || location.address.trim();
    if (!address) return;
    const districtRaw =
      location.district ||
      String(listingDistrict ?? "").trim() ||
      null;
    const district = isCyprusDistrict(districtRaw ?? "")
      ? (districtRaw as ClinicLocation["district"])
      : location.district;
    const existingCoords = clinicLocationCoordinates(location);
    const next = existingCoords
      ? manualClinicLocation({
          address,
          district,
          coords: existingCoords,
        })
      : clinicLocationFromParts({
          address,
          district,
          latitude: location.latitude,
          longitude: location.longitude,
          placeId: null,
          town: location.town,
        });
    setLocation(next);
    setOrigin(clinicLocationCoordinates(next));
    setManualAddressDraft(address);
    setStreetTouched(true);
    setStreetError(false);
    if (hasConfirmedClinicCoordinates(next) && next.district) {
      setMode("confirmed");
      return;
    }
    // Address known but no pin yet — open the pin sheet with the typed address.
    const center =
      district && isCyprusDistrict(district)
        ? fallbackDistrictCoordinates(district)
        : null;
    if (center) {
      setOrigin(center);
      setLocation(
        manualClinicLocation({
          address,
          district,
          coords: center,
        }),
      );
    }
    setMode("manual");
  };

  const startManual = () => {
    setLocation(emptyClinicLocation());
    setOrigin(null);
    setManualAddressDraft("");
    setStreetTouched(false);
    setStreetError(false);
    autoPrefillCoordsKeyRef.current = null;
    setPinSuggestion(null);
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
    autoPrefillCoordsKeyRef.current = null;
    setLocation((current) =>
      center
        ? manualClinicLocation({ address: current.address, district, coords: center })
        : { ...current, district, latitude: null, longitude: null },
    );
  };

  /** Adopts the address under the pin (search path — may realign district). */
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

  /** Manual path: keep the doctor's district; only rewrite the street text. */
  const acceptManualPinSuggestion = () => {
    if (!pinSuggestion || !coords) return;
    const address = stripPlusCodePrefix(pinSuggestion.address);
    setManualAddressDraft(address);
    setStreetTouched(true);
    setStreetError(false);
    setLocation((current) =>
      manualClinicLocation({
        address,
        district: current.district,
        coords,
      }),
    );
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

  const trySaveManualLocation = () => {
    if (isComplete) {
      setStreetError(false);
      setMode("confirmed");
      return;
    }
    if (!location.district || !coords) return;
    if (!location.address.trim()) {
      setStreetError(true);
      streetInputRef.current?.focus();
      streetInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
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
          <span className={styles.adjusted}>
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
      <span className={styles.label}>District</span>
      <select
        value={location.district ?? ""}
        onChange={(event) => handleDistrictChange(event.target.value)}
        className={styles.input}
        aria-label="District"
      >
        <option value="">Select a district</option>
        {CYPRUS_DISTRICTS.map((district) => (
          <option key={district} value={district}>
            {district}
          </option>
        ))}
      </select>
      <span className={styles.helper}>
        Patients filter by district, so check this matches your clinic.
      </span>
    </label>
  );

  return (
    <div
      className="group"
      data-validate-field={includeHiddenInputs ? "1" : undefined}
      data-invalid={includeHiddenInputs ? "0" : undefined}
      data-field-key={fieldKey}
      data-field-label={fieldLabel}
    >
      {!hideIntro ? (
        <>
          <span className={registerLabelClass}>
            {fieldLabel}
            <span className="text-red-600">*</span>
          </span>
          <p className={styles.helper}>
            {hint
              ? "Confirm the clinic from your listing, or search Google / drop a pin if you need a different one."
              : "Search for your clinic on Google — that gives us the address patients read and the map pin for “near me”. If Google does not list it, drop a pin and type what patients should see."}
          </p>
          {hint ? (
            <p className={styles.helper}>
              Your listing already shows:{" "}
              <span className={styles.listingHint}>{hint}</span>
              {mode === "confirmed"
                ? ". Check it below — change it only if it is wrong."
                : "."}
            </p>
          ) : null}
          {showAddLaterHint ? (
            <p className={styles.helper}>
              If you work at more than one clinic, you can add the others later in Settings.
            </p>
          ) : null}
        </>
      ) : null}

      {mode === "confirmed" && location.address.trim() ? (
        addressDistrictConflict ? (
          <div
            className={styles.amberNotice}
            data-testid="clinic-district-mismatch"
          >
            <p className={styles.body}>{location.address}</p>
            <p className={`mt-1 ${styles.amberNoticeText}`}>
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
        <div
          className={styles.summaryPanel}
          data-testid="clinic-location-saved-summary"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className={styles.eyebrow}>
              Patients will see
            </p>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                location.placeId
                  ? styles.badgeGoogle
                  : coords
                    ? styles.badgePin
                    : styles.badgeSaved
              }`}
            >
              {location.placeId
                ? "From Google"
                : coords
                  ? "Pin + typed address"
                  : "Saved address"}
            </span>
          </div>
          <p className={`mt-1.5 ${styles.body}`}>{location.address}</p>
          {location.district ? (
            <p className={`mt-1 ${styles.muted}`}>
              District:{" "}
              <span className={styles.emphasis}>
                {location.district}
              </span>
              {coords ? (
                <span className={styles.quiet}>
                  {" "}
                  · map pin set for nearby search
                </span>
              ) : null}
            </p>
          ) : null}
          {!coords ? (
            <p className={styles.amberHint}>
              Add a map pin so nearby patients can find you accurately in Health Finder.
            </p>
          ) : !location.placeId ? (
            <p className={`mt-2 ${styles.soft}`}>
              Maps opens a search for this text. Prefer a Google result when you can, so the pin
              and address match a real place.
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
            ) : (
              <button
                type="button"
                onClick={() => {
                  setManualAddressDraft(location.address);
                  setStreetTouched(true);
                  setStreetError(false);
                  const district = location.district;
                  const center =
                    district && isCyprusDistrict(district)
                      ? fallbackDistrictCoordinates(district)
                      : null;
                  if (center) {
                    setOrigin(center);
                    setLocation((current) =>
                      manualClinicLocation({
                        address: current.address,
                        district: current.district,
                        coords: center,
                      }),
                    );
                  }
                  setMode("manual");
                }}
                className={linkClass}
              >
                Add map pin
              </button>
            )}
            <button type="button" onClick={startSearch} className={linkClass}>
              Change clinic address
            </button>
          </div>
        </div>
        )
      ) : null}

      {mode === "search" ? (
        <>
          {hint ? (
            <div
              className={styles.summaryPanel}
              data-testid="clinic-listing-confirm-panel"
            >
              <p className={styles.eyebrow}>From your listing</p>
              <p className={`mt-1.5 ${styles.body}`}>{hint}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmListingAddress}
                  className={styles.secondaryButton}
                  data-testid="clinic-confirm-listing-address"
                >
                  Confirm this address
                </button>
                <button type="button" onClick={startSearch} className={linkClass}>
                  Search a different clinic
                </button>
              </div>
            </div>
          ) : null}
          <ClinicAddressSearchInput
            key={searchSession}
            id={
              inputId ??
              (index === 0 ? "register-clinic-address" : `register-clinic-address-${index}`)
            }
            tone={tone}
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
            onCancel={
              location.address.trim() ? () => setMode("confirmed") : undefined
            }
          />
          <p className={styles.helper}>
            Can&rsquo;t find it on Google?{" "}
            <button type="button" onClick={startManual} className={linkClass}>
              Drop a pin instead
            </button>
          </p>
        </>
      ) : null}

      {mode === "adjust" && coords ? (
        <div className={styles.panel}>
          <p className={styles.eyebrow}>
            Patients will see
          </p>
          <p className={`mt-1 flex items-start gap-1.5 ${styles.body}`}>
            <MapPin className={styles.pinIcon} aria-hidden />
            {location.address}
          </p>

          {mapPreview}

          {/* Offered, not asserted. Google returns Cyprus streets in Greek or in
              Latin depending on the point, so a difference here does not prove
              the doctor's address is wrong — it is their call. */}
          {suggestionAddress ? (
            <div
              className={styles.clinicalNotice}
              data-testid="clinic-pin-suggestion"
            >
              <p className={styles.clinicalNoticeText}>
                Google reads the pin as{" "}
                <span className={styles.clinicalNoticeStrong}>{suggestionAddress}</span>
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
              className={styles.amberNotice}
              data-testid="clinic-pin-mismatch"
            >
              <p className={styles.amberNoticeText}>
                The pin is a long way from the address above. Undo it, or search for the clinic
                again with the right street.
              </p>
            </div>
          ) : null}

          {pinMoved && !suggestionAddress && !showPinMismatch ? (
            <p className={`mt-2 ${styles.soft}`}>
              Patients still read the address above. The pin only sets where you appear nearby.
            </p>
          ) : null}

          {/* Read-only on purpose. Letting the doctor override this produced
              records like a Paphos address filed under Limassol; if the district
              is wrong, the address is wrong and they should search again. */}
          {location.district ? (
            <p className={`mt-3 ${styles.muted}`}>
              District:{" "}
              <span className={styles.emphasis}>
                {location.district}
              </span>
            </p>
          ) : null}

          {addressDistrictConflict ? (
            <div
              className={styles.amberNotice}
              data-testid="clinic-district-mismatch"
            >
              <p className={styles.amberNoticeText}>
                The address says{" "}
                <span className="font-semibold">
                  {location.address.match(/Nicosia|Limassol|Paphos|Pafos|Larnaca|Famagusta/i)?.[0] ??
                    "a different city"}
                </span>
                , but the district is set to {location.district}. Search again for the right
                clinic, or drop a pin yourself.
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
              Search again
            </button>
          </div>
        </div>
      ) : null}

      {mode === "manual" ? (
        <div className={styles.panel}>
          <p className={styles.stepMuted}>
            <span className={styles.stepStrong}>1.</span> District{" "}
            <span className={styles.stepDot}>·</span>{" "}
            <span className={styles.stepStrong}>2.</span> Pin on your clinic{" "}
            <span className={styles.stepDot}>·</span>{" "}
            <span className={styles.stepStrong}>3.</span> Address patients will see
          </p>

          {districtSelect}

          {coords ? (
            <>
              {mapPreview}

              {suggestionAddress ? (
                <div
                  className={styles.clinicalNotice}
                  data-testid="clinic-manual-pin-suggestion"
                >
                  <p className={styles.clinicalNoticeText}>
                    Suggested from the pin:{" "}
                    <span className={styles.clinicalNoticeStrong}>{suggestionAddress}</span>
                  </p>
                  <button
                    type="button"
                    onClick={acceptManualPinSuggestion}
                    className={`mt-2 ${secondaryButtonClass}`}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Use this address
                  </button>
                </div>
              ) : null}

              <label className="mt-3 block" htmlFor={`register-manual-street-${index}`}>
                <span className={styles.label}>
                  Address patients will see
                </span>
                <input
                  ref={streetInputRef}
                  id={`register-manual-street-${index}`}
                  type="text"
                  value={manualAddressDraft}
                  aria-invalid={streetError || undefined}
                  aria-describedby={
                    streetError
                      ? `register-manual-street-error-${index}`
                      : `register-manual-street-hint-${index}`
                  }
                  onChange={(event) => {
                    const raw = event.target.value;
                    setStreetTouched(true);
                    setStreetError(false);
                    setManualAddressDraft(raw);
                    setLocation((current) =>
                      manualClinicLocation({
                        address: raw,
                        district: current.district,
                        coords: clinicLocationCoordinates(current) ?? coords,
                      }),
                    );
                  }}
                  placeholder="e.g. 12 Makariou Avenue, 2nd floor"
                  autoComplete="street-address"
                  className={`${styles.input}${
                    streetError ? " border-red-400 focus:border-red-400 focus:ring-red-400/25" : ""
                  }`}
                />
                {streetError ? (
                  <span
                    id={`register-manual-street-error-${index}`}
                    className={styles.streetError}
                    data-testid="clinic-manual-street-error"
                  >
                    Add the address patients will see, then save.
                  </span>
                ) : (
                  <span
                    id={`register-manual-street-hint-${index}`}
                    className={styles.helper}
                  >
                    This text appears on your profile and in Maps search — use a real street
                    address.
                  </span>
                )}
              </label>
            </>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={trySaveManualLocation}
              disabled={!coords || !location.district}
              className={primaryButtonClass}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Save this location
            </button>
            <button type="button" onClick={startSearch} className={secondaryButtonClass}>
              <Search className="h-3.5 w-3.5" aria-hidden />
              Back to Google search
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

      {includeHiddenInputs ? (
        <>
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
          <input
            type="hidden"
            name={names.district}
            value={location.district ?? ""}
            readOnly
            aria-hidden
          />
          <input type="hidden" name={names.town} value={location.town ?? ""} readOnly aria-hidden />

          <p className={registerFieldErrorClass}>
            Search for your clinic on Google, or drop a pin and type the address patients will see.
          </p>
        </>
      ) : null}
    </div>
  );
}
