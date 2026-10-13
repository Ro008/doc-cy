"use client";

import * as React from "react";
import { RegisterClinicAddressField } from "@/components/auth/RegisterClinicAddressField";
import type { ClinicPick } from "@/lib/clinic-change-request";
import { emptyClinicLocation } from "@/lib/clinic-location";

/**
 * The /register clinic picker in the settings chrome (user, 2026-09-30): DocCy's own
 * clinics first, then Google Maps or a pin, then the name and phone of a clinic DocCy
 * does not have yet. Reports every change as one `ClinicPick`.
 * "Request a change to clinic details" uses it for the address alone (user,
 * 2026-10-11): Google Maps or a pin, no DocCy search, no name and phone fields.
 */
export function ClinicPicker({
  initial,
  onChange,
  docCySearch = true,
  showDetailsFields = true,
  plainSummary = false,
  takenClinicIds,
}: {
  initial?: Partial<ClinicPick>;
  onChange: (pick: ClinicPick) => void;
  /** False: the address is found on Google Maps or with a pin only. */
  docCySearch?: boolean;
  /** False: no name and phone fields (the caller has its own). */
  showDetailsFields?: boolean;
  /** The address as it is, without the "Patients will see" heading and its source chip. */
  plainSummary?: boolean;
  /** DocCy clinics left out of the search: the ones she already works at. */
  takenClinicIds?: readonly string[];
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
        docCySearch={docCySearch}
        tone="dark"
        hideIntro
        includeHiddenInputs={false}
        showDetailsFields={showDetailsFields}
        showAddLaterHint={false}
        plainSummary={plainSummary}
        takenClinicIds={takenClinicIds}
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
