"use client";

import { MessageCircle } from "lucide-react";

import { emitOpenFeedback } from "@/lib/doccy-feedback";

const VARIANTS = {
  primary:
    "bg-clinical-500 px-5 py-2.5 text-sm font-semibold text-ink-900 shadow-lg shadow-clinical-500/20 hover:bg-clinical-400",
  soft: "border border-clinical-400/40 bg-clinical-500/10 px-4 py-2 text-sm font-semibold text-clinical-200 hover:bg-clinical-500/20",
  link: "px-0 py-0 text-sm font-semibold text-clinical-300 hover:text-clinical-200",
} as const;

/** Opens the same support form as Support in the account menu. */
export function HelpContactButton({
  label = "Contact us",
  variant = "primary",
  message,
  testId = "help-contact",
}: {
  label?: string;
  variant?: keyof typeof VARIANTS;
  /** Prefilled text, e.g. which tutorial the question is about. */
  message?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => emitOpenFeedback({ subject: "General Question", ...(message ? { message } : {}) })}
      data-testid={testId}
      className={`inline-flex items-center gap-2 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 ${VARIANTS[variant]}`}
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
