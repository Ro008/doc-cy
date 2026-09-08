"use client";

import * as React from "react";

/**
 * Shared read of the register form's field completion state.
 *
 * Each field wrapper carries `data-validate-field="1"` plus a `data-field-key` /
 * `data-field-label` pair so the summary and the progress bar can name it.
 * Composite fields (specialties, languages, photo) validate through a hidden
 * `data-validity-proxy` input, since their real controls are buttons.
 */

export type RegisterFieldState = {
  key: string;
  label: string;
  complete: boolean;
};

const FIELD_SELECTOR = "[data-validate-field='1']";

function validityControl(field: HTMLElement): HTMLElement | null {
  return (
    field.querySelector<HTMLElement>("[data-validity-proxy='true']") ??
    field.querySelector<HTMLElement>("input,select,textarea")
  );
}

export function isRegisterFieldComplete(field: HTMLElement): boolean {
  const control = validityControl(field);
  if (
    !(
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement
    )
  ) {
    return true;
  }
  return control.checkValidity();
}

/**
 * The control a user can actually see. Composite fields expose their trigger via
 * `data-focus-target`; without it the first hidden input would swallow the focus
 * call and the page would not move at all.
 */
function focusTarget(field: HTMLElement): HTMLElement | null {
  const explicit = field.querySelector<HTMLElement>("[data-focus-target='true']");
  if (explicit) return explicit;
  const candidates = field.querySelectorAll<HTMLElement>(
    "input:not([type='hidden']),select,textarea,button",
  );
  for (const candidate of Array.from(candidates)) {
    if (candidate.hasAttribute("data-validity-proxy")) continue;
    if (candidate.getAttribute("aria-hidden") === "true") continue;
    if (candidate.tabIndex < 0) continue;
    return candidate;
  }
  return null;
}

export function readRegisterFields(form: HTMLFormElement): RegisterFieldState[] {
  return Array.from(form.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).map(
    (field, index) => ({
      key: field.dataset.fieldKey ?? `field-${index}`,
      label: field.dataset.fieldLabel ?? `Field ${index + 1}`,
      complete: isRegisterFieldComplete(field),
    }),
  );
}

/** Scrolls the field into view, focuses something visible, and flashes it. */
export function revealRegisterField(form: HTMLFormElement, key: string): void {
  const field = form.querySelector<HTMLElement>(`${FIELD_SELECTOR}[data-field-key="${key}"]`);
  if (!field) return;

  field.scrollIntoView({ behavior: "smooth", block: "center" });
  focusTarget(field)?.focus({ preventScroll: true });

  field.dataset.flash = "1";
  window.setTimeout(() => {
    delete field.dataset.flash;
  }, 1600);
}

function sameStates(a: RegisterFieldState[], b: RegisterFieldState[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (state, index) =>
      state.key === b[index]!.key &&
      state.label === b[index]!.label &&
      state.complete === b[index]!.complete,
  );
}

export function useRegisterFieldStates(formId: string): RegisterFieldState[] {
  const [fields, setFields] = React.useState<RegisterFieldState[]>([]);

  React.useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    let frame = 0;

    const sync = () => {
      const next = readRegisterFields(form);
      setFields((current) => (sameStates(current, next) ? current : next));
    };

    // Combobox picks are button clicks: React updates the proxy input's value as a
    // property, so re-read after the render rather than on the event itself.
    const syncAfterRender = () => {
      sync();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    sync();
    form.addEventListener("input", syncAfterRender, true);
    form.addEventListener("change", syncAfterRender, true);
    form.addEventListener("click", syncAfterRender, true);
    form.addEventListener("focusout", syncAfterRender, true);
    form.addEventListener("submit", syncAfterRender, true);

    // Composite fields swap their markup (clinic summary, specialty rows) without
    // firing form events, so watch the tree as well.
    const observer = new MutationObserver(sync);
    observer.observe(form, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("input", syncAfterRender, true);
      form.removeEventListener("change", syncAfterRender, true);
      form.removeEventListener("click", syncAfterRender, true);
      form.removeEventListener("focusout", syncAfterRender, true);
      form.removeEventListener("submit", syncAfterRender, true);
      observer.disconnect();
    };
  }, [formId]);

  return fields;
}
