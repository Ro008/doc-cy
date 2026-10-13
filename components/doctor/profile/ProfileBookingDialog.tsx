"use client";

import * as React from "react";
import { createPortal } from "react-dom";

type Props = {
  /** Read by screen readers as the dialog's name. */
  label: string;
  onClose: () => void;
  /** Shown next to the content on a wide screen, under it on a phone ("What to expect"). */
  aside?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * The booking panel's second step, over the page (user, 2026-10-13): the details form does
 * not fit in a narrow panel that has to stay on screen. Drawn inside `.doccy-profile` so it
 * keeps the profile's light or dark colours. Escape goes back, like the content's own button
 * ("Change time", "Done"); a click on the backdrop does not, so a half-filled form is not
 * lost by accident.
 */
export function ProfileBookingDialog({ label, onClose, aside, children }: Props) {
  const [host, setHost] = React.useState<Element | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setHost(document.querySelector(".doccy-profile") ?? document.body);
  }, []);

  // The page behind does not scroll while the dialog is open.
  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    if (host) boxRef.current?.focus();
  }, [host]);

  if (!host) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-10"
      data-testid="profile-booking-dialog"
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative mx-auto grid gap-4 outline-none ${aside ? "max-w-4xl lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start" : "max-w-xl"}`}
      >
        <div className="min-w-0">{children}</div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </div>,
    host,
  );
}
