"use client";

import * as React from "react";
import { Crosshair, LoaderCircle, MapPin, Undo2 } from "lucide-react";
import { coordinatesNearlyEqual } from "@/lib/clinic-location-pin";
import { loadGoogleMapsPlaces } from "@/lib/google-maps-loader";
import type { Coordinates } from "@/lib/finder-distance";

type Props = {
  /** Where the pin sits. Changing this from outside re-centres the map. */
  center: Coordinates;
  onCenterChange?: (coords: Coordinates) => void;
  zoom?: number;
  /** Shows the "Location adjusted" banner and the undo control. */
  moved?: boolean;
  onUndo?: () => void;
  /**
   * Interactive maps swallow a one-finger drag, which is a scroll trap inside a
   * long form. Inline previews stay non-interactive and the real adjusting
   * happens in a full-screen sheet, where there is nothing to scroll past.
   */
  interactive?: boolean;
  className?: string;
  frameClassName?: string;
  label?: string;
};

/**
 * Map with a pin fixed at the centre of the viewport: the doctor pans the map
 * underneath it instead of dragging a marker. That is the ride-hailing pattern
 * and it is far easier on a phone, where dragging a marker inside a 200px map
 * mostly ends up panning the map by accident.
 *
 * The pin is plain DOM rather than a google.maps marker, so we need neither the
 * deprecated Marker class nor a Map ID for advanced markers.
 */
export function ClinicPinMap({
  center,
  onCenterChange,
  zoom = 17,
  moved = false,
  onUndo,
  interactive = true,
  className = "",
  frameClassName = "h-52",
  label = "Clinic location map",
}: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const onCenterChangeRef = React.useRef(onCenterChange);
  const centerRef = React.useRef(center);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [locating, setLocating] = React.useState(false);
  const [locateError, setLocateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  React.useEffect(() => {
    centerRef.current = center;
  }, [center]);

  // Create the map once. `center`/`zoom` are only the initial camera; later
  // changes are applied by the sync effect below.
  React.useEffect(() => {
    let cancelled = false;
    let idleListener: google.maps.MapsEventListener | null = null;

    loadGoogleMapsPlaces()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;

        const map = new maps.Map(containerRef.current, {
          center: { lat: centerRef.current.latitude, lng: centerRef.current.longitude },
          zoom,
          disableDefaultUI: true,
          zoomControl: interactive,
          // "greedy" moves the pin with one finger, which is what we want in the
          // sheet. "none" lets a touch over an inline preview scroll the page.
          gestureHandling: interactive ? "greedy" : "none",
          clickableIcons: false,
        });
        mapRef.current = map;

        idleListener = map.addListener("idle", () => {
          const next = map.getCenter();
          if (!next) return;
          const coords: Coordinates = { latitude: next.lat(), longitude: next.lng() };
          // Our own setCenter calls also fire `idle`; ignoring no-op deltas keeps
          // this from bouncing between the map and React state.
          if (coordinatesNearlyEqual(coords, centerRef.current)) return;
          onCenterChangeRef.current?.(coords);
        });

        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      idleListener?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const current = map.getCenter();
    if (current) {
      const currentCoords: Coordinates = { latitude: current.lat(), longitude: current.lng() };
      if (coordinatesNearlyEqual(currentCoords, center)) return;
    }
    map.setCenter({ lat: center.latitude, lng: center.longitude });
  }, [center, status]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setLocateError("Your browser cannot share your location.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const map = mapRef.current;
        if (!map) return;
        map.setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        map.setZoom(Math.max(map.getZoom() ?? zoom, 18));
      },
      () => {
        setLocating(false);
        setLocateError("We could not get your location. Move the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };

  if (status === "error") {
    return (
      <p className={`text-xs text-amber-700 ${className}`} role="alert">
        The map could not load, so we will use the coordinates from your search.
      </p>
    );
  }

  return (
    <div className={className}>
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-ink-200 bg-ink-100 ${frameClassName}`}
      >
        <div ref={containerRef} className="absolute inset-0" aria-label={label} role="application" />

        {/* Pin tip sits exactly on the map centre. */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full"
          aria-hidden
        >
          <MapPin className="h-9 w-9 fill-clinical-500 text-white drop-shadow-md" strokeWidth={1.5} />
        </div>
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-900/70"
          aria-hidden
        />

        {/* Controls stay along the top: Google's logo and attribution sit at the
            bottom edge and must not be covered. */}
        {interactive ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2">
            <p className="rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-ink-700 shadow-sm">
              {moved ? "Location adjusted" : "Move the map to put the pin on your entrance"}
              {moved && onUndo ? (
                <button
                  type="button"
                  onClick={onUndo}
                  className="pointer-events-auto ml-2 inline-flex items-center gap-1 font-semibold text-clinical-700 underline underline-offset-2 transition hover:text-clinical-600"
                >
                  <Undo2 className="h-3 w-3" aria-hidden />
                  Undo
                </button>
              ) : null}
            </p>

            <button
              type="button"
              onClick={locateMe}
              disabled={status !== "ready" || locating}
              className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-ink-700 shadow-sm transition hover:text-clinical-700 disabled:opacity-60"
            >
              {locating ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Crosshair className="h-3.5 w-3.5" aria-hidden />
              )}
              I&rsquo;m at the clinic now
            </button>
          </div>
        ) : null}

        {status === "loading" ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink-100">
            <p className="text-xs text-ink-500">Loading map…</p>
          </div>
        ) : null}
      </div>

      {locateError ? (
        <p className="mt-1 text-xs text-amber-700" role="alert">
          {locateError}
        </p>
      ) : null}
    </div>
  );
}
