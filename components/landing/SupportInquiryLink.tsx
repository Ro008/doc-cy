"use client";

import { emitOpenFeedback, type DocCyOpenFeedbackDetail } from "@/lib/doccy-feedback";

export function SupportInquiryLink({
  label,
  feedbackDetail,
}: {
  label: string;
  feedbackDetail?: DocCyOpenFeedbackDetail;
}) {
  return (
    <button
      type="button"
      onClick={() => emitOpenFeedback(feedbackDetail)}
      className="text-sm font-semibold text-emerald-300 underline decoration-emerald-400/60 underline-offset-2 hover:text-emerald-200"
    >
      {label}
    </button>
  );
}

