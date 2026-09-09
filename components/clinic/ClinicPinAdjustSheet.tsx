"use client";

import * as React from "react";
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
 * The fixed-centre-pin pattern needs a one-finger drag to pan, which fights the
 * page scroll when the map is inline in a long form. Giving it its own screen
 * removes the conflict: there is nothing behind the map to scroll to.
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
  React.useEffect(() => {
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
  }, [onCancel, onClose]);

  return (
    <div
      // Above the PWA install banner (z-95) and the cookie bar (z-96), which
      // otherwise cover the confirm button on a phone.
      className="fixed inset-0 z-[100] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Adjust your clinic location"
      data-testid="clinic-pin-sheet"
    >
      <div className="flex items-start justify-between gap-3 border-b border-ink-200 px-4 py-3">
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

      <div className="border-t border-ink-200 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-clinical-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-clinical-400"
        >
          <Check className="h-4 w-4" aria-hidden />
          Use this location
        </button>
      </div>
    </div>
  );
}
