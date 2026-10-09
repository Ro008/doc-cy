"use client";

import { SETTINGS_PRIMARY_BUTTON_CLASS, SETTINGS_SECONDARY_BUTTON_CLASS } from "@/components/dashboard/settings/styles";
import * as React from "react";
import { createPortal } from "react-dom";

const LEAVE_MS = 160;

/**
 * Modal used across the settings sections: dark card over a dimmed page, fades in and
 * out. Esc and the backdrop close it; the footer gets `close` to close with the same
 * animation (then `onClose` runs).
 */
export function SettingsDialog({
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  children?: React.ReactNode;
  footer: React.ReactNode | ((close: () => void) => React.ReactNode);
  wide?: boolean;
}) {
  const titleId = React.useId();
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const leavingRef = React.useRef(false);
  const close = React.useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => onCloseRef.current(), LEAVE_MS);
  }, []);

  React.useEffect(() => {
    setMounted(true);
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    const first = panelRef.current?.querySelector<HTMLElement>("input, textarea, select, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, close]);

  if (!mounted) return null;
  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink-900/75 p-4 ${
        leaving ? "settings-backdrop-out" : "settings-backdrop-in"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`my-auto w-full ${wide ? "max-w-xl" : "max-w-md"} rounded-3xl border border-slate-700/70 bg-[#0B1A30] p-6 shadow-xl shadow-black/40 ${
          leaving ? "settings-dialog-out" : "settings-dialog-in"
        }`}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-50">
          {title}
        </h2>
        {description ? (
          <div className="mt-2 text-sm leading-relaxed text-slate-300">{description}</div>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {typeof footer === "function" ? footer(close) : footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const dialogSecondaryButtonClass = SETTINGS_SECONDARY_BUTTON_CLASS;

export const dialogPrimaryButtonClass = SETTINGS_PRIMARY_BUTTON_CLASS;

export const dialogDangerButtonClass =
  "inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-rose-50 transition hover:bg-rose-500 disabled:opacity-60";
