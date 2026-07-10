"use client";

import * as React from "react";
import { X } from "lucide-react";
import { phoneToTelHref } from "@/lib/phone-link";

type Props = {
  open: boolean;
  doctorName: string;
  addressMapsLink: string;
  phone?: string | null;
  wasDuplicate?: boolean;
  onClose: () => void;
};

export function ManualBookingRequestModal({
  open,
  doctorName,
  addressMapsLink,
  phone = null,
  wasDuplicate = false,
  onClose,
}: Props) {
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const phoneDisplay = String(phone ?? "").trim();
  const phoneHref = phoneToTelHref(phoneDisplay);

  React.useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-booking-request-modal-title"
        className="relative z-[81] w-full max-w-md overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-[0_24px_64px_rgba(26,43,60,0.28)]"
      >
        <div className="border-b border-ink-100 bg-gradient-to-b from-amber-50 to-white px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="manual-booking-request-modal-title"
              className="text-lg font-bold leading-snug tracking-tight text-ink-950"
            >
              🛑 Profile not activated yet
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 text-sm leading-relaxed text-ink-800 sm:px-6">
          <p>
            <span className="font-semibold text-ink-950">{doctorName}</span> hasn&apos;t activated
            online booking on DocCy yet.{" "}
            {wasDuplicate ? (
              <>
                We already counted your request from this device in the last few months — no need to
                vote again. We&apos;ll still alert their clinic that patients are waiting here! 🚀
              </>
            ) : (
              <>
                We just counted your click as an official request to open their digital calendar.
                We&apos;ll alert their clinic that patients are waiting here! 🚀
              </>
            )}
          </p>

          <div className="rounded-xl border border-clinical-200 bg-clinical-50/70 px-4 py-4">
            <p className="font-semibold text-ink-950">☎️ Need to book right now?</p>
            {phoneDisplay && phoneHref ? (
              <>
                <p className="mt-2 text-ink-700">Call their clinic directly:</p>
                <p className="mt-3">
                  <a
                    href={phoneHref}
                    className="inline-flex items-center gap-1.5 text-lg font-bold tabular-nums text-clinical-700 underline decoration-clinical-300 underline-offset-2 transition hover:text-clinical-600"
                  >
                    📞 {phoneDisplay}
                  </a>
                </p>
              </>
            ) : (
              <p className="mt-2 text-ink-700">
                Their phone is currently the only way to get an appointment:
              </p>
            )}
            <p className="mt-3">
              <a
                href={addressMapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-clinical-700 underline decoration-clinical-300 underline-offset-2 transition hover:text-clinical-600"
              >
                👉 Open clinic on Google Maps ↗
              </a>
            </p>
            <p className="mt-4 text-ink-700">
              Next time you talk to them, tell them to activate their DocCy profile so you can book
              online!
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-clinical-500 text-sm font-semibold text-white transition hover:bg-clinical-400"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
