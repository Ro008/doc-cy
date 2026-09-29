"use client";

import { emitOpenFeedback } from "@/lib/doccy-feedback";
import { alreadyHasProfileSupportMessage } from "@/lib/register-gate";

/** Opens the support form, prefilled to ask the founders to merge a listing into her profile. */
export function RegisterHasProfileContactButton({
  listingName,
  className,
}: {
  listingName: string | null;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-testid="register-has-profile-contact"
      onClick={() =>
        emitOpenFeedback({
          subject: "General Question",
          message: alreadyHasProfileSupportMessage(listingName),
        })
      }
      className={className}
    >
      Contact us
    </button>
  );
}
