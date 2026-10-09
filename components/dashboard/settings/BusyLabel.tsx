import * as React from "react";
import { Loader2 } from "lucide-react";

/**
 * The inside of a settings button that waits for something (user, 2026-10-09): while
 * `busy`, a spinner and the "-ing…" text; otherwise its own icon and label. The button
 * itself sets `disabled` and `aria-busy` (see the loading rules in ./styles.ts).
 */
export function BusyLabel({
  busy,
  busyText,
  icon,
  children,
}: {
  busy: boolean;
  /** e.g. "Saving…" — always ends with "…". */
  busyText: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (busy) {
    return (
      <>
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        {busyText}
      </>
    );
  }
  return (
    <>
      {icon}
      {children}
    </>
  );
}

/** A spinner on its own, for icon-only buttons and inline "Saving…" notes. */
export function BusySpinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`${className} shrink-0 animate-spin`} aria-hidden />;
}

/** A small inline "Saving…" next to controls that save the moment they change. */
export function SavingNote({ busy, text = "Saving…" }: { busy: boolean; text?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 text-xs text-slate-400 transition-opacity ${busy ? "opacity-100" : "opacity-0"}`}
    >
      {busy ? (
        <>
          <BusySpinner className="h-3.5 w-3.5" />
          {text}
        </>
      ) : null}
    </span>
  );
}
