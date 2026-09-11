"use client";

import * as React from "react";
import { RegisterClinicAddressField } from "@/components/auth/RegisterClinicAddressField";
import type { ClinicLocation } from "@/lib/clinic-location";

type Props = {
  id: string;
  value: ClinicLocation;
  onChange: (value: ClinicLocation) => void;
  disabled?: boolean;
};

/**
 * Settings clinic address editor — same MAP wizard as registration (search /
 * pin adjust / manual), using dark tone to match Settings chrome.
 */
export function ClinicAddressAutocomplete({ id, value, onChange, disabled = false }: Props) {
  return (
    <div
      className={`mt-2 ${disabled ? "pointer-events-none opacity-60" : ""}`}
      data-testid="settings-clinic-address-wizard"
    >
      <RegisterClinicAddressField
        initialLocation={value}
        onLocationChange={onChange}
        includeHiddenInputs={false}
        showAddLaterHint={false}
        hideIntro
        inputId={id}
        tone="dark"
      />
    </div>
  );
}
