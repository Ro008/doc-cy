"use client";

import * as React from "react";
import { RegisterClinicAddressField } from "@/components/auth/RegisterClinicAddressField";
import type { ClinicPick } from "@/lib/clinic-change-request";
import { emptyClinicLocation } from "@/lib/clinic-location";

/**
 * The /register clinic picker in the settings chrome (user, 2026-09-30): DocCy's own
 * clinics first, then Google Maps or a pin, then the name and phone of a clinic DocCy
 * does not have yet. Reports every change as one `ClinicPick`.
 */
export function ClinicPicker({
  initial,
  onChange,
}: {
  initial?: Partial<ClinicPick>;
  onChange: (pick: ClinicPick) => void;
}) {
  const [pick, setPick] = React.useState<ClinicPick>(() => ({
    clinicId: initial?.clinicId ?? null,
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    location: initial?.location ?? emptyClinicLocation(),
  }));
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  React.useEffect(() => {
    onChangeRef.current(pick);
  }, [pick]);

  const update = React.useCallback(
    (patch: Partial<ClinicPick>) => setPick((prev) => ({ ...prev, ...patch })),
    [],
  );

  return (
    <div data-testid="settings-clinic-picker">
      <RegisterClinicAddressField
        docCySearch
        tone="dark"
        hideIntro
        includeHiddenInputs={false}
        showDetailsFields
        showAddLaterHint={false}
        initialLocation={initial?.location ?? null}
        initialClinicName={initial?.name ?? null}
        initialClinicPhone={initial?.phone ?? ""}
        onLocationChange={(location) => update({ location })}
        onClinicChange={(clinic) => update({ clinicId: clinic?.id ?? null })}
        onNameChange={(name) => update({ name: name ?? "" })}
        onPhoneChange={(phone) => update({ phone })}
      />
    </div>
  );
}
