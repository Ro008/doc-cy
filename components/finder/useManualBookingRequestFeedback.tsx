"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  patientBookingRequestErrorMessage,
  submitPatientBookingRequest,
} from "@/lib/finder-manual-patient-booking-request";
import {
  googleAdsRequestOnlineBookingSendTo,
  reportGoogleAdsConversion,
} from "@/lib/google-ads";

export const PATIENT_BOOKING_REQUEST_THANKS_TOAST =
  "Thank you! We will notify the doctor.";

export function useManualBookingRequestFeedback() {
  const router = useRouter();
  const [pendingManualId, setPendingManualId] = React.useState<string | null>(null);

  async function submit(
    manualId: string,
    extras?: { clinicId?: string | null; source?: string | null },
  ) {
    if (pendingManualId) return;
    setPendingManualId(manualId);
    try {
      const result = await submitPatientBookingRequest({
        manualId,
        clinicId: extras?.clinicId,
        source: extras?.source,
      });
      if (result.ok === false) {
        toast.error(patientBookingRequestErrorMessage(result.reason, result.status));
        return;
      }
      if (!result.duplicate) {
        reportGoogleAdsConversion(googleAdsRequestOnlineBookingSendTo());
      }
      toast.success(PATIENT_BOOKING_REQUEST_THANKS_TOAST);
      router.refresh();
    } finally {
      setPendingManualId(null);
    }
  }

  return { pendingManualId, submit };
}
