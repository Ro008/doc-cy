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
      className="inline-flex w-full items-center justify-center rounded-xl border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:border-clinical-300 hover:text-clinical-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2"
    >
      Contact us to get set up
    </button>
  );
}
