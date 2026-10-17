"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Her own photo on a Finder card opens larger over the page (mockup R3; user, 2026-10-17).
 * Only for a photo she added: the default avatars stay a link to her profile.
 */
export function FinderCardPhotoZoom({
  src,
  name,
  meta,
  className,
  children,
}: {
  src: string;
  name: string;
  /** Her specialties, under the name. */
  meta: string;
  /** The card's photo tile. */
  className: string;
  /** The small photo in the tile. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const openerRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      // One button inside: keep the focus on it.
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  const label = `Photo of ${name}`;

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        aria-label={`Show the photo of ${name} larger`}
        data-testid="finder-card-photo-zoom"
        onClick={() => setOpen(true)}
        className={`${className} block cursor-zoom-in p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400`}
      >
        {children}
      </button>
      {open
        ? createPortal(
            // Inside the themed root, so the dialog follows Light / Dark.
            <div
              className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[rgba(8,20,42,0.72)] px-4 py-6 sm:px-6 sm:py-20"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <figure
                role="dialog"
                aria-modal="true"
                aria-label={label}
                data-testid="finder-card-photo-dialog"
                className="m-0 w-full max-w-[440px] rounded-3xl bg-profile-surface p-3 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
              >
                <div className="relative">
                  <img
                    src={src}
                    alt={label}
                    className="block aspect-[4/5] w-full rounded-2xl bg-[#D5EEF0] object-cover [.doccy-profile[data-scheme=dark]_&]:bg-[#22446F]"
                  />
                  <button
                    ref={closeRef}
                    type="button"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                    className="absolute right-2.5 top-2.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#0B2236] shadow-[0_2px_8px_rgba(0,0,0,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400"
                  >
                    <X className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </button>
                </div>
                <figcaption className="flex flex-col gap-0.5 px-2 pb-1 pt-3">
                  <span className="text-lg font-bold text-profile-text">{name}</span>
                  {meta ? <span className="text-sm text-profile-muted">{meta}</span> : null}
                </figcaption>
              </figure>
            </div>,
            openerRef.current?.closest(".doccy-profile") ?? document.body,
          )
        : null}
    </>
  );
}
