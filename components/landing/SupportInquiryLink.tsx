"use client";

import { emitOpenFeedback } from "@/lib/doccy-feedback";

export function SupportInquiryLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => emitOpenFeedback()}
      className="text-sm font-semibold text-emerald-300 underline decoration-emerald-400/60 underline-offset-2 hover:text-emerald-200"
    >
      {label}
    </button>
  );
}

