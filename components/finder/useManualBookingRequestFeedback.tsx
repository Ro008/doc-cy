"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  phone?: string | null;
  addressText?: string | null;
};

export function useManualBookingRequestFeedback({
  manualId,
  doctorName,
  addressMapsLink,
  phone = null,
  addressText = null,
}: Options) {
  const router = useRouter();
  const [pendingSlotKey, setPendingSlotKey] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  async function submit(slotKey: string) {
    if (pendingSlotKey) return;
    setPendingSlotKey(slotKey);
    try {
      const result = await submitPatientBookingRequest(manualId);
      if (result.ok === false) {
        toast.error(patientBookingRequestErrorMessage(result.reason, result.status));
        return;
      }
      setModalOpen(true);
      router.refresh();
    } finally {
      setPendingSlotKey(null);
    }
  }

  const modal = (
    <ManualBookingRequestModal
      open={modalOpen}
      doctorName={doctorName}
      addressMapsLink={addressMapsLink}
      phone={phone}
      addressText={addressText}
      onClose={() => setModalOpen(false)}
    />
  );

  return { pendingSlotKey, submit, modal };
}
