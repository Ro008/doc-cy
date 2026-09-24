"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { RegisterClinicAddressField } from "@/components/auth/RegisterClinicAddressField";
import { REGISTER_REVEAL_EVENT } from "@/components/auth/useRegisterFieldStates";
import { clinicLocationFromParts, type ClinicLocation } from "@/lib/clinic-location";
import type { RegisterClaimClinic } from "@/lib/claim-directory-professional";
import { registerClinicLocationIsComplete } from "@/lib/register-clinic-location";
import { registerAddAnotherButtonClass } from "@/lib/register-ui";

type Slot = {
  key: string;
  initial: ClinicLocation | null;
  /** Clinic name from the claimed listing, until they pick another clinic. */
  listingName: string | null;
  listingAddressHint: string | null;
  listingDistrict: string | null;
};

type SlotSummary = { name: string | null; address: string; complete: boolean };

function initialSlots(
  clinics: readonly RegisterClaimClinic[],
  fallbackHint: string | null,
  fallbackDistrict: string | null,
): Slot[] {
  if (clinics.length === 0) {
    return [
      {
        key: "initial-0",
        initial: null,
        listingName: null,
        listingAddressHint: fallbackHint,
        listingDistrict: fallbackDistrict,
      },
    ];
  }
  // Keys are rendered (data-clinic-slot), so they must match between server and client.
  return clinics.map((clinic, index) => ({
    key: `initial-${index}`,
    initial: clinicLocationFromParts({
      address: clinic.address,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      placeId: clinic.placeId,
      district: clinic.district,
      town: clinic.town,
    }),
    listingName: clinic.name.trim() || null,
    listingAddressHint: clinic.address,
    listingDistrict: clinic.district,
  }));
}

/**
 * Every clinic the professional works at (up to `max`). A claim starts with all
 * of the listing's clinics. With two or more, each is a row and only one is open;
 * the rest fold to a one-line summary so the step stays short. Rows stay mounted,
 * so their posted fields and validation keep working while folded, and the
 * posted indices stay contiguous (the server stops reading at the first gap).
 */
export function RegisterClinicsFields({
  claimClinics,
  listingAddressHint = null,
  listingDistrict = null,
  max,
}: {
  claimClinics: readonly RegisterClaimClinic[];
  /** Claim without linked clinics: the listing's own address to confirm. */
  listingAddressHint?: string | null;
  listingDistrict?: string | null;
  max: number;
}) {
  const [slots, setSlots] = React.useState<Slot[]>(() =>
    initialSlots(claimClinics.slice(0, max), listingAddressHint, listingDistrict),
  );
  /** The one open row; null when they folded it (every row closed). */
  const [openKey, setOpenKey] = React.useState<string | null>(() => slots[0]!.key);
  const [summaries, setSummaries] = React.useState<Record<string, SlotSummary>>(() =>
    Object.fromEntries(
      slots.map((slot) => [
        slot.key,
        {
          name: slot.listingName,
          address: slot.initial?.address ?? "",
          complete: slot.initial ? registerClinicLocationIsComplete(slot.initial) : false,
        },
      ]),
    ),
  );
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const addedCount = React.useRef(0);

  // "Jump to Clinic 2" from the missing-fields list: open that row first.
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onReveal = (event: Event) => {
      const row = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-clinic-slot]");
      const key = row?.dataset.clinicSlot;
      if (key) flushSync(() => setOpenKey(key));
    };
    root.addEventListener(REGISTER_REVEAL_EVENT, onReveal);
    return () => root.removeEventListener(REGISTER_REVEAL_EVENT, onReveal);
  }, []);

  const updateSummary = (key: string, patch: Partial<SlotSummary>) =>
    setSummaries((current) => ({
      ...current,
      [key]: { name: null, address: "", complete: false, ...current[key], ...patch },
    }));

  const addSlot = () => {
    addedCount.current += 1;
    const slot: Slot = {
      key: `added-${addedCount.current}`,
      initial: null,
      listingName: null,
      listingAddressHint: null,
      listingDistrict: null,
    };
    setSlots((current) => [...current, slot]);
    setOpenKey(slot.key);
  };

  const removeSlot = (key: string) => {
    const at = slots.findIndex((slot) => slot.key === key);
    const next = slots.filter((slot) => slot.key !== key);
    setSlots(next);
    if (openKey === key && next.length > 0) {
      setOpenKey(next[Math.max(0, at - 1)]!.key);
    }
  };

  const multiple = slots.length > 1;
  // One at a time: no new row while one is still empty or half set.
  const unfinished = slots.findIndex((slot) => !summaries[slot.key]?.complete);

  return (
    <div ref={rootRef} className="space-y-2.5">
      {slots.map((slot, index) => {
        const open = !multiple || openKey === slot.key;
        const summary = summaries[slot.key];
        const title = summary?.name || summary?.address || "Not set yet";
        const done = Boolean(summary?.complete);
        return (
          <section
            key={slot.key}
            data-clinic-row={index}
            data-clinic-slot={slot.key}
            data-clinic-complete={done ? "1" : "0"}
            className={
              multiple
                ? `rounded-2xl border ${open ? "border-clinical-300 bg-white" : "border-ink-100 bg-ink-50"}`
                : undefined
            }
          >
            {multiple ? (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <button
                  type="button"
                  data-clinic-row-toggle
                  aria-expanded={open}
                  onClick={() => setOpenKey(open ? null : slot.key)}
                  className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 text-left lg:min-h-[36px]"
                >
                  <span
                    aria-hidden
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                      done ? "bg-wellness-500 text-white" : "border border-ink-200 bg-white text-ink-600"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-ink-900">Clinic {index + 1}</span>
                  <span className="min-w-0 truncate text-[13px] text-ink-600">{title}</span>
                  <ChevronDown
                    className={`ml-auto h-4 w-4 shrink-0 text-ink-400 transition ${open ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  onClick={() => removeSlot(slot.key)}
                  aria-label={`Remove clinic ${index + 1}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : null}
            <div hidden={!open} className={multiple ? "border-t border-ink-100 px-3 pb-3 pt-2" : undefined}>
              <RegisterClinicAddressField
                index={index}
                docCySearch
                initialLocation={slot.initial}
                initialClinicName={slot.listingName}
                listingAddressHint={slot.listingAddressHint}
                listingDistrict={slot.listingDistrict}
                showAddLaterHint={false}
                hideIntro={multiple}
                heading={multiple || index > 0 ? `Clinic ${index + 1} address` : undefined}
                onLocationChange={(location) => updateSummary(slot.key, { address: location.address })}
                onCompleteChange={(complete) => updateSummary(slot.key, { complete })}
                onNameChange={(name) => updateSummary(slot.key, { name })}
              />
            </div>
          </section>
        );
      })}

      {slots.length < max ? (
        <div className="flex flex-wrap items-center gap-x-3">
          <button
            type="button"
            onClick={addSlot}
            disabled={unfinished !== -1}
            className={`${registerAddAnotherButtonClass} disabled:cursor-not-allowed disabled:text-ink-400 disabled:hover:bg-transparent`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add another clinic
          </button>
          {unfinished !== -1 && multiple ? (
            <span className="text-xs text-ink-500">
              Finish clinic {unfinished + 1} to add another.
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-ink-500">Maximum of {max} clinics.</p>
      )}
    </div>
  );
}
