"use client";

import * as React from "react";
import { Smartphone } from "lucide-react";
import { personalMobileDisplay, personalMobileTelHref } from "@/lib/public/profile-personal-mobile";

type Props = {
  professionalId: string;
  label: string;
  loadingLabel: string;
  errorLabel: string;
  /** The look of where it sits: the hero's link, or a button in Clinics & contact. */
  className: string;
  testId: string;
  /** Where the button is, for the recorded click; unset = her profile. */
  source?: "finder_card" | null;
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; mobile: string }
  | { status: "error" };

/**
 * "Show mobile" on the public profile (hero, and Clinics & contact): the professional's
 * personal mobile, when she chose to show it. The number is fetched on the click (never in the page's HTML) and the
 * button becomes a link that dials it.
 */
export function RevealMobileButton({
  professionalId,
  label,
  loadingLabel,
  errorLabel,
  className,
  testId,
  source = null,
}: Props) {
  const [state, setState] = React.useState<State>({ status: "idle" });

  const reveal = async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/directory/professional-mobile-reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: professionalId, ...(source ? { source } : {}) }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; phone?: unknown } | null;
      const mobile = res.ok && data?.ok && typeof data.phone === "string" ? data.phone.trim() : "";
      setState(mobile ? { status: "ready", mobile } : { status: "error" });
    } catch {
      setState({ status: "error" });
    }
  };

  if (state.status === "ready") {
    const href = personalMobileTelHref(state.mobile);
    const display = personalMobileDisplay(state.mobile);
    return (
      <a
        href={href ?? undefined}
        data-testid={testId}
        className={`inline-flex items-center gap-1.5 tabular-nums ${className}`}
      >
        <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
        {display}
      </a>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      disabled={state.status === "loading"}
      aria-busy={state.status === "loading"}
      onClick={reveal}
      className={`inline-flex items-center gap-1.5 font-bold disabled:cursor-wait disabled:opacity-70 ${className}`}
    >
      <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
      <span aria-live="polite">
        {state.status === "loading" ? loadingLabel : state.status === "error" ? errorLabel : label}
      </span>
    </button>
  );
}
