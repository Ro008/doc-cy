"use client";

import * as React from "react";
import { phoneToTelHref } from "@/lib/phone-link";

type ContactRevealKind = "manual" | "clinic";

type RevealState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; phone: string }
  | { status: "empty" }
  | { status: "error"; message: string };

async function fetchContactPhone(
  kind: ContactRevealKind,
  id: string,
): Promise<{ phone: string | null } | { error: string }> {
  try {
    const res = await fetch("/api/directory/contact-reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; phone?: string | null; reason?: string }
      | null;
    if (!res.ok || !data?.ok) {
      if (res.status === 429) {
        return { error: "Too many requests. Please try again later." };
      }
      return { error: "Could not load phone number." };
    }
    return { phone: typeof data.phone === "string" ? data.phone.trim() || null : null };
  } catch {
    return { error: "Could not load phone number." };
  }
}

type RevealPhoneButtonProps = {
  kind: ContactRevealKind;
  id: string;
  /** When false, show nothing (no phone on file). */
  hasPhone: boolean;
  className?: string;
  revealedClassName?: string;
};

/** Button that loads a phone number only after an intentional click. */
export function RevealPhoneButton({
  kind,
  id,
  hasPhone,
  className,
  revealedClassName,
}: RevealPhoneButtonProps) {
  const [state, setState] = React.useState<RevealState>({ status: "idle" });

  if (!hasPhone) return null;

  if (state.status === "ready") {
    const href = phoneToTelHref(state.phone);
    if (!href) return null;
    return (
      <a
        href={href}
        className={
          revealedClassName ??
          "inline-flex items-center gap-1.5 text-lg font-bold tabular-nums text-clinical-700 underline decoration-clinical-300 underline-offset-2 transition hover:text-clinical-600"
        }
      >
        📞 {state.phone}
      </a>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={state.status === "loading"}
        onClick={async () => {
          setState({ status: "loading" });
          const result = await fetchContactPhone(kind, id);
          if ("error" in result) {
            setState({ status: "error", message: result.error });
            return;
          }
          if (!result.phone) {
            setState({ status: "empty" });
            return;
          }
          setState({ status: "ready", phone: result.phone });
        }}
        className={
          className ??
          "inline-flex min-h-10 items-center justify-center rounded-lg border border-clinical-200 bg-white px-3 py-2 text-sm font-semibold text-clinical-700 transition hover:border-clinical-300 hover:bg-clinical-50 disabled:cursor-wait disabled:opacity-60"
        }
      >
        {state.status === "loading" ? "Loading…" : "Show phone"}
      </button>
      {state.status === "error" ? (
        <p className="text-xs text-amber-800">{state.message}</p>
      ) : null}
      {state.status === "empty" ? (
        <p className="text-xs text-ink-500">No phone number is available for this listing.</p>
      ) : null}
    </div>
  );
}

/** Fetch phone when a parent becomes active (e.g. booking modal opens). */
export function useContactPhoneReveal(
  kind: ContactRevealKind,
  id: string,
  enabled: boolean,
  hasPhone: boolean,
): RevealState {
  const [state, setState] = React.useState<RevealState>({ status: "idle" });

  React.useEffect(() => {
    if (!enabled || !hasPhone) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      const result = await fetchContactPhone(kind, id);
      if (cancelled) return;
      if ("error" in result) {
        setState({ status: "error", message: result.error });
        return;
      }
      if (!result.phone) {
        setState({ status: "empty" });
        return;
      }
      setState({ status: "ready", phone: result.phone });
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, id, enabled, hasPhone]);

  return state;
}
