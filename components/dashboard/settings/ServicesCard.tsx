"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import {
  SettingsDialog,
  dialogDangerButtonClass,
  dialogSecondaryButtonClass,
} from "@/components/dashboard/settings/SettingsDialog";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_EYEBROW_CLASS,
  SETTINGS_GHOST_BUTTON_CLASS,
  SETTINGS_LINK_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";
import {
  MAX_SERVICES,
  SERVICE_NAME_MAX,
  formatServicePrice,
  parseSavedServices,
  parseServicePrice,
  serviceNameTaken,
  validateService,
  type SavedService,
  type ServiceErrors,
} from "@/lib/settings-services";

const INPUT_CLASS =
  "w-full rounded-xl border bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:ring-2";
const INPUT_OK = "border-slate-700 focus:border-clinical-400/60 focus:ring-clinical-400/30";
const INPUT_BAD = "border-red-400/70 focus:border-red-400 focus:ring-red-400/25";
const ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress aria-busy:opacity-100";

type Typed = { name: string; price: string; priceFrom: boolean };
const EMPTY: Typed = { name: "", price: "", priceFrom: false };
const NAME_TAKEN = "You already list a service with this name.";

/** What the form shows for a saved service; older free-text prices start empty. */
function typedFrom(service: SavedService): Typed {
  const price = parseServicePrice(service.price);
  return { name: service.name, price: price?.amount ?? "", priceFrom: price?.from ?? false };
}

/**
 * Services & prices (user, 2026-10-10): her price list as patients read it, the name on
 * the left and the price in euros on the right, exact or "From". She adds, edits and
 * removes lines one at a time (removing asks first); no founder, each change is recorded.
 * POST /api/professional-services { name, price, priceFrom } → { service };
 * PUT { id, name, price, priceFrom } → { service }; DELETE ?id=…
 */
export function ServicesCard({ initial = [] }: { initial?: SavedService[] }) {
  const baseId = React.useId();
  const [items, setItems] = React.useState<SavedService[]>(initial);
  /** "new" while adding, a service id while editing that line, null when the form is closed. */
  const [open, setOpen] = React.useState<string | null>(initial.length === 0 ? "new" : null);
  const [typed, setTyped] = React.useState<Typed>(EMPTY);
  const [errors, setErrors] = React.useState<ServiceErrors>({});
  const [busy, setBusy] = React.useState(false);
  /** The service she asked to remove, until she confirms or keeps it. */
  const [toRemove, setToRemove] = React.useState<SavedService | null>(null);
  const [removing, setRemoving] = React.useState(false);
  const full = items.length >= MAX_SERVICES;

  const set = <K extends keyof Typed>(field: K, value: Typed[K]) => {
    setTyped((previous) => ({ ...previous, [field]: value }));
    const errorField = field === "name" ? "name" : "price";
    if (errors[errorField]) setErrors((previous) => ({ ...previous, [errorField]: undefined }));
  };

  const close = (remaining: number = items.length) => {
    // With nothing listed the form stays open: it is the only thing to do here.
    setOpen(remaining === 0 ? "new" : null);
    setTyped(EMPTY);
    setErrors({});
  };

  const startAdding = () => {
    setTyped(EMPTY);
    setErrors({});
    setOpen("new");
  };

  const startEditing = (service: SavedService) => {
    setTyped(typedFrom(service));
    setErrors({});
    setOpen(service.id);
  };

  async function save() {
    const editingId = open === "new" ? undefined : (open ?? undefined);
    const check = validateService(typed);
    if (check.ok === false) {
      setErrors(check.errors);
      return;
    }
    if (serviceNameTaken(items, check.service.name, editingId)) {
      setErrors({ name: NAME_TAKEN });
      return;
    }
    const fallback = editingId ? "Could not save the service." : "Could not add the service.";
    setBusy(true);
    try {
      const res = await fetch("/api/professional-services", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          name: typed.name,
          price: typed.price.trim() || null,
          priceFrom: typed.priceFrom,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const [saved] = parseSavedServices([data?.service]);
      if (!res.ok || !saved) {
        if (data?.errors && typeof data.errors === "object") setErrors(data.errors as ServiceErrors);
        else if (res.status === 409 && data?.message === NAME_TAKEN) setErrors({ name: NAME_TAKEN });
        toast.error(typeof data?.message === "string" ? data.message : fallback, { id: "services" });
        return;
      }
      const next = editingId
        ? items.map((row) => (row.id === editingId ? saved : row))
        : [...items, saved];
      setItems(next);
      close(next.length);
      toast.success(editingId ? "Service saved." : "Service added to your price list.", { id: "services" });
    } catch (err) {
      console.error(err);
      toast.error(fallback, { id: "services" });
    } finally {
      setBusy(false);
    }
  }

  /** True when the service is off the list, so the dialog can close. */
  async function remove(service: SavedService): Promise<boolean> {
    setRemoving(true);
    try {
      const res = await fetch(`/api/professional-services?id=${encodeURIComponent(service.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      // 404: it is already gone from her list, so it leaves the list here too.
      if (!res.ok && res.status !== 404) {
        toast.error(typeof data?.message === "string" ? data.message : "Could not remove the service.", {
          id: "services",
        });
        return false;
      }
      const next = items.filter((row) => row.id !== service.id);
      setItems(next);
      if (next.length === 0) startAdding();
      toast.success("Service removed.", { id: "services" });
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Could not remove the service.", { id: "services" });
      return false;
    } finally {
      setRemoving(false);
    }
  }

  const onEnter = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  };

  const form = (editing: boolean) => {
    const nameId = `${baseId}-name`;
    const priceId = `${baseId}-price`;
    const preview = typed.price.trim() ? `${typed.priceFrom ? "From " : ""}€${typed.price.trim()}` : null;
    return (
      // Not a <form>: the settings page is one already.
      <fieldset
        disabled={busy}
        data-testid="settings-service-form"
        className="min-w-0 space-y-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-4"
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div>
            <label htmlFor={nameId} className="text-xs font-medium text-slate-300">
              Service <span className="text-red-300">*</span>
            </label>
            <input
              id={nameId}
              type="text"
              autoComplete="off"
              autoFocus={editing}
              maxLength={SERVICE_NAME_MAX}
              value={typed.name}
              onChange={(event) => set("name", event.target.value)}
              onKeyDown={onEnter}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
              placeholder="For example: First consultation"
              className={`mt-1.5 ${INPUT_CLASS} ${errors.name ? INPUT_BAD : INPUT_OK}`}
            />
            {errors.name ? (
              <p id={`${nameId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-300">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={priceId} className="text-xs font-medium text-slate-300">
              Price <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <div className="relative mt-1.5">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400"
              >
                €
              </span>
              <input
                id={priceId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                maxLength={8}
                value={typed.price}
                onChange={(event) => set("price", event.target.value)}
                onKeyDown={onEnter}
                aria-invalid={errors.price ? true : undefined}
                aria-describedby={errors.price ? `${priceId}-error` : undefined}
                placeholder="60"
                className={`${INPUT_CLASS} pl-7 tabular-nums ${errors.price ? INPUT_BAD : INPUT_OK}`}
              />
            </div>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={typed.priceFrom}
            onChange={(event) => set("priceFrom", event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-950 accent-clinical-400"
          />
          <span>
            This is a starting price
            <span className="block text-xs text-slate-500">
              Patients see &ldquo;From&rdquo; before the amount{preview && typed.priceFrom ? `: ${preview}` : "."}
            </span>
          </span>
        </label>
        {errors.price ? (
          <p id={`${priceId}-error`} role="alert" className="text-xs font-medium text-red-300">
            {errors.price}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            aria-busy={busy}
            className={SETTINGS_PRIMARY_BUTTON_CLASS}
          >
            <BusyLabel busy={busy} busyText={editing ? "Saving…" : "Adding…"}>
              {editing ? "Save" : "Add service"}
            </BusyLabel>
          </button>
          {editing || items.length > 0 ? (
            <button type="button" disabled={busy} onClick={() => close()} className={SETTINGS_GHOST_BUTTON_CLASS}>
              Cancel
            </button>
          ) : null}
        </div>
      </fieldset>
    );
  };

  return (
    <section className={SETTINGS_CARD_CLASS} data-testid="settings-services">
      <div className="flex items-baseline justify-between gap-3">
        <p className={SETTINGS_EYEBROW_CLASS}>Your price list</p>
        {items.length > 0 ? (
          <p className="text-xs tabular-nums text-slate-500" data-testid="settings-services-count">
            {items.length} of {MAX_SERVICES}
          </p>
        ) : null}
      </div>

      {items.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-800/80">
          {items.map((service) => {
            if (open === service.id) {
              return (
                <li key={service.id} className="py-3">
                  {form(true)}
                </li>
              );
            }
            const price = formatServicePrice(service.price);
            return (
              <li key={service.id} className="group flex items-center gap-3 py-3">
                <p className="min-w-0 flex-1 break-words text-sm font-medium text-slate-100">{service.name}</p>
                {price ? (
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-100">{price}</p>
                ) : (
                  <p className="shrink-0 text-xs text-slate-500">No price</p>
                )}
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Edit ${service.name}`}
                    disabled={busy}
                    onClick={() => startEditing(service)}
                    className={`${ICON_BUTTON_CLASS} hover:bg-white/5 hover:text-slate-200`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${service.name}`}
                    disabled={busy}
                    onClick={() => setToRemove(service)}
                    className={`${ICON_BUTTON_CLASS} hover:bg-rose-500/10 hover:text-rose-300`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-300">
          Nothing listed yet. Add what you offer so patients know what to book you for.
        </p>
      )}

      <div className="mt-3">
        {open === "new" ? (
          form(false)
        ) : open ? null : full ? (
          <p className="text-xs text-slate-400">You can list up to {MAX_SERVICES}. Remove one to add another.</p>
        ) : (
          <button type="button" onClick={startAdding} disabled={busy} className={SETTINGS_LINK_CLASS}>
            + Add a service
          </button>
        )}
      </div>

      {toRemove ? (
        <SettingsDialog
          title={`Remove ${toRemove.name}?`}
          description="It comes off your price list and your public profile right away. To list it again, you add it again."
          onClose={() => setToRemove(null)}
          busy={removing}
          footer={(closeDialog) => (
            <>
              <button type="button" onClick={closeDialog} disabled={removing} className={dialogSecondaryButtonClass}>
                Keep it
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await remove(toRemove)) closeDialog();
                }}
                disabled={removing}
                aria-busy={removing}
                className={dialogDangerButtonClass}
              >
                <BusyLabel busy={removing} busyText="Removing…">
                  Remove
                </BusyLabel>
              </button>
            </>
          )}
        />
      ) : null}
    </section>
  );
}
