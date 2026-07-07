"use client";

import * as React from "react";
import { toast } from "sonner";
import { ManualBookingRequestModal } from "@/components/finder/ManualBookingRequestModal";
import {
  patientBookingRequestErrorMessage,
  submitPatientBookingRequest,
} from "@/lib/finder-manual-patient-booking-request";

type Options = {
  manualId: string;
  doctorName: string;
  addressMapsLink: string;
};

export function useManualBookingRequestFeedback({
  manualId,
  doctorName,
  addressMapsLink,
}: Options) {
  const [pending, setPending] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);

  async function submit() {
    if (pending) return;
    setPending(true);
    try {
      const result = await submitPatientBookingRequest(manualId);
      if (result.ok === false) {
        toast.error(patientBookingRequestErrorMessage(result.reason, result.status));
        return;
      }
      setModalOpen(true);
    } finally {
      setPending(false);
    }
  }

  const modal = (
    <ManualBookingRequestModal
      open={modalOpen}
      doctorName={doctorName}
      addressMapsLink={addressMapsLink}
      onClose={() => setModalOpen(false)}
    />
  );

  return { pending, submit, modal };
}
