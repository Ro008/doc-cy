"use client";

import * as React from "react";
import {
  CALL_TO_BOOK_BUTTON_LABEL,
  parseCallToBookSource,
  type CallToBookSource,
} from "@/lib/call-to-book";
import { googleAdsCallToBookSendTo, reportGoogleAdsConversion } from "@/lib/google-ads";
import { formatCyprusPhoneDisplay, phoneToTelHref } from "@/lib/phone-link";

type ContactRevealKind = "manual" | "clinic";

type RevealState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; phone: string }
  | { status: "empty" }
  | { status: "error"; message: string };

async function fetchContactPhone(input: {
  kind: ContactRevealKind;
  id: string;
  source?: CallToBookSource | null;
  manualId?: string | null;
  clinicId?: string | null;
}): Promise<{ phone: string | null } | { error: string }> {
  try {
    const res = await fetch("/api/directory/contact-reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: input.kind,
        id: input.id,
        ...(input.source ? { source: input.source } : {}),
        ...(input.manualId ? { manualId: input.manualId } : {}),
        ...(input.clinicId ? { clinicId: input.clinicId } : {}),
      }),
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
  variant?: "show-phone" | "call-to-book";
  /** Founder analytics — only sent for Call to Book CTAs. */
  source?: CallToBookSource | null;
  /** Professional id when revealing a clinic phone from a listing card. */
  manualId?: string | null;
  /** Clinic id when revealing a listing phone for a specific location. */
  clinicId?: string | null;
};

function RevealedPhoneLink({
  phone,
  className,
  variant,
}: {
  phone: string;
  className?: string;
  variant: "show-phone" | "call-to-book";
}) {
  const display = formatCyprusPhoneDisplay(phone);
  const href = phoneToTelHref(display);
  if (!href) return null;
  return (
    <a
      href={href}
      className={
        className ??
        "inline-flex items-center gap-1.5 text-lg font-bold tabular-nums text-clinical-700 underline decoration-clinical-300 underline-offset-2 transition hover:text-clinical-600"
      }
    >
      {variant === "call-to-book" ? `Call ${display}` : `📞 ${display}`}
    </a>
  );
}

/** Button that loads a phone number only after an intentional click. */
export function RevealPhoneButton({
  kind,
  id,
  hasPhone,
  className,
  revealedClassName,
  variant = "show-phone",
  source = null,
  manualId = null,
  clinicId = null,
}: RevealPhoneButtonProps) {
  const [state, setState] = React.useState<RevealState>({ status: "idle" });
  const analyticsSource = parseCallToBookSource(source);

  if (!hasPhone) return null;

  if (state.status === "ready") {
    return (
      <RevealedPhoneLink
        phone={state.phone}
        className={revealedClassName}
        variant={variant}
      />
    );
  }

  const idleLabel = variant === "call-to-book" ? CALL_TO_BOOK_BUTTON_LABEL : "Show phone";

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={state.status === "loading"}
        onClick={async () => {
          setState({ status: "loading" });
          const result = await fetchContactPhone({
            kind,
            id,
            source: variant === "call-to-book" ? analyticsSource : null,
            manualId,
            clinicId,
          });
          if ("error" in result) {
            setState({ status: "error", message: result.error });
            return;
          }
          if (!result.phone) {
            setState({ status: "empty" });
            return;
          }
          if (variant === "call-to-book") {
            reportGoogleAdsConversion(googleAdsCallToBookSendTo());
          }
          setState({ status: "ready", phone: result.phone });
        }}
        className={
          className ??
          "inline-flex min-h-10 items-center justify-center rounded-lg border border-clinical-200 bg-white px-3 py-2 text-sm font-semibold text-clinical-700 transition hover:border-clinical-300 hover:bg-clinical-50 disabled:cursor-wait disabled:opacity-60"
        }
      >
        {state.status === "loading" ? "Loading…" : idleLabel}
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
      const result = await fetchContactPhone({ kind, id });
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
