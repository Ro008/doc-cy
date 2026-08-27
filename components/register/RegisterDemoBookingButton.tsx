"use client";

import {
  DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE,
  DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST,
  emitOpenFeedback,
} from "@/lib/doccy-feedback";

export function RegisterDemoBookingButton() {
  return (
    <button
      type="button"
      data-testid="register-demo-booking"
      onClick={() =>
        emitOpenFeedback({
          subject: DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST,
          message: DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE,
        })
      }
      className="inline-flex w-full items-center justify-center rounded-xl border-2 border-clinical-500 bg-clinical-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(18,184,192,0.25)] transition hover:bg-clinical-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2"
    >
      Book my In-Person Demo
    </button>
  );
}
