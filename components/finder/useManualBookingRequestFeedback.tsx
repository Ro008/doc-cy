"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  patientBookingRequestErrorMessage,
  submitPatientBookingRequest,
} from "@/lib/finder-manual-patient-booking-request";
import type { FinderManualSlotClick } from "@/lib/finder-manual-slot-click";

const ManualBookingRequestModal = dynamic(
  () =>
    import("@/components/finder/ManualBookingRequestModal").then(
      (mod) => mod.ManualBookingRequestModal,
    ),
  { ssr: false },
);

type ManualListing = Pick<
  FinderManualSlotClick,
  "manualId" | "doctorName" | "addressMapsLink" | "hasPhone" | "addressText"
>;

export function useManualBookingRequestFeedback() {
  const router = useRouter();
  const [pendingSlotKey, setPendingSlotKey] = React.useState<string | null>(null);
  const [listing, setListing] = React.useState<ManualListing | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  async function submit(nextListing: ManualListing, slotKey: string) {
    if (pendingSlotKey) return;
    setPendingSlotKey(slotKey);
    setListing(nextListing);
    try {
      const result = await submitPatientBookingRequest(nextListing.manualId);
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

  const modal =
    modalOpen && listing ? (
      <ManualBookingRequestModal
        open
        doctorName={listing.doctorName}
        manualId={listing.manualId}
        addressMapsLink={listing.addressMapsLink}
        hasPhone={listing.hasPhone}
        addressText={listing.addressText}
        onClose={() => setModalOpen(false)}
      />
    ) : null;

  return { pendingSlotKey, submit, modal };
}
