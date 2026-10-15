"use client";

import { Flag } from "lucide-react";
import { emitOpenFeedback } from "@/lib/doccy-feedback";

/**
 * "Report incorrect information": opens DocCy's feedback form with the profile
 * named in the message, so corrections reach us with the right page attached.
 */
export function ProfileReportLink({ label, message }: { label: string; message: string }) {
  return (
    <button
      type="button"
      onClick={() => emitOpenFeedback({ message })}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-profile-muted underline-offset-2 transition hover:text-profile-text hover:underline focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Flag className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
