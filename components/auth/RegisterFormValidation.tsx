"use client";

import * as React from "react";

type Props = {
  formId: string;
};

function getPrimaryControl(field: HTMLElement): HTMLElement | null {
  return (
    field.querySelector<HTMLElement>("[data-validity-proxy='true']") ??
    field.querySelector<HTMLElement>("input,select,textarea")
  );
}

function setFieldInvalidState(field: HTMLElement, attempted: boolean) {
  const control = getPrimaryControl(field);
  if (!control || !(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
    field.dataset.invalid = "0";
    return;
  }

  const touched = field.dataset.touched === "1";
  const shouldShow = attempted || touched;
  const invalid = !control.checkValidity();
  const shouldMarkInvalid = shouldShow && invalid;
  field.dataset.invalid = shouldMarkInvalid ? "1" : "0";
  const hints = field.querySelectorAll<HTMLElement>(".field-hint");
  hints.forEach((hint) => {
    if (shouldMarkInvalid) {
      hint.classList.remove("hidden");
    } else {
      hint.classList.add("hidden");
    }
  });
}

export function RegisterFormValidation({ formId }: Props) {
  React.useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const fields = Array.from(form.querySelectorAll<HTMLElement>("[data-validate-field='1']"));
    let attempted = false;

    const syncAll = () => {
      for (const field of fields) {
        setFieldInvalidState(field, attempted);
      }
    };

    const markTouched = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return;
      const field = target.closest<HTMLElement>("[data-validate-field='1']");
      if (!field) return;
      field.dataset.touched = "1";
      setFieldInvalidState(field, attempted);
    };

    const onFocusOut = (event: FocusEvent) => {
      markTouched(event.target);
    };

    const onInput = (event: Event) => {
      markTouched(event.target);
    };

    const onChange = (event: Event) => {
      markTouched(event.target);
    };

    const onSubmit = (event: Event) => {
      attempted = true;
      form.dataset.attempted = "1";
      syncAll();
      if (!form.checkValidity()) {
        event.preventDefault();
        const firstInvalid = form.querySelector<HTMLElement>("[data-validate-field='1'][data-invalid='1'] input, [data-validate-field='1'][data-invalid='1'] select, [data-validate-field='1'][data-invalid='1'] textarea, [data-validate-field='1'][data-invalid='1'] button");
        firstInvalid?.focus();
      }
    };

    form.addEventListener("focusout", onFocusOut, true);
    form.addEventListener("input", onInput, true);
    form.addEventListener("change", onChange, true);
    form.addEventListener("submit", onSubmit, true);
    syncAll();

    return () => {
      form.removeEventListener("focusout", onFocusOut, true);
      form.removeEventListener("input", onInput, true);
      form.removeEventListener("change", onChange, true);
      form.removeEventListener("submit", onSubmit, true);
    };
  }, [formId]);

  return null;
}
