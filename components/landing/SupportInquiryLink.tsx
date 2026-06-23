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
      className="text-sm font-semibold text-clinical-600 underline decoration-clinical-300 underline-offset-2 hover:text-clinical-500"
    >
      {label}
    </button>
  );
}
