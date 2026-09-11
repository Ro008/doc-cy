"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { ClinicPinMap } from "@/components/clinic/ClinicPinMap";
import { clinicPinMoved } from "@/lib/clinic-location-pin";
import type { Coordinates } from "@/lib/finder-distance";

type Props = {
  center: Coordinates;
  onCenterChange: (coords: Coordinates) => void;
  /** Coordinates to snap back to, i.e. where the search or district put the pin. */
  origin: Coordinates | null;
  onClose: () => void;
  /** Restores the pin to where it was when the sheet opened. */
  onCancel: () => void;
  address?: string;
  zoom?: number;
};

/**
 * Full-screen surface for moving the pin.
 *
 * Portaled to `document.body` so `position: fixed` is not trapped by ancestors
 * with `transform` / `filter` / `backdrop-filter` (e.g. Settings' blurred card).
 * Without that, the chrome can sit off-screen and the doctor is stuck on the map.
 */
export function ClinicPinAdjustSheet({
  center,
  onCenterChange,
  origin,
  onClose,
  onCancel,
  address,
  zoom = 17,
}: Props) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mounted, onCancel, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      // Above the PWA install banner (z-95) and the cookie bar (z-96), which
      // otherwise cover the confirm button on a phone.
      className="fixed inset-0 z-[100] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Adjust your clinic location"
      data-testid="clinic-pin-sheet"
    >
      <div
        className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-200 bg-white px-4 py-3"
        data-testid="clinic-pin-sheet-header"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">Put the pin on your clinic</p>
          {address ? <p className="truncate text-xs text-ink-500">{address}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => {
            onCancel();
            onClose();
          }}
          aria-label="Cancel"
          className="shrink-0 rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <ClinicPinMap
        center={center}
        onCenterChange={onCenterChange}
        zoom={zoom}
        moved={clinicPinMoved(origin, center)}
        onUndo={origin ? () => onCenterChange(origin) : undefined}
        className="flex min-h-0 flex-1 flex-col"
        frameClassName="min-h-0 flex-1 rounded-none border-0"
      />

      <div
        className="shrink-0 border-t border-ink-200 bg-white px-4 py-3"
        data-testid="clinic-pin-sheet-footer"
      >
        <button
          type="button"
          onClick={onClose}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-clinical-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-clinical-400"
        >
          <Check className="h-4 w-4" aria-hidden />
          Use this location
        </button>
      </div>
    </div>,
    document.body,
  );
}
