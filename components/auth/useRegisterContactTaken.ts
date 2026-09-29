"use client";

import * as React from "react";
import {
  REGISTER_CONTACT_TAKEN_EVENT,
  type RegisterContactTakenDetail,
} from "@/components/auth/register-contact-check";

/**
 * The "already used by another professional" message for one field, from the Account
 * step's contact check. Cleared by the field as soon as the user edits it.
 */
export function useRegisterContactTaken(
  inputRef: React.RefObject<HTMLInputElement>,
  field: keyof RegisterContactTakenDetail,
): [string | null, () => void] {
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onTaken = (event: Event) => {
      setMessage((event as CustomEvent<RegisterContactTakenDetail>).detail?.[field] ?? null);
    };
    form.addEventListener(REGISTER_CONTACT_TAKEN_EVENT, onTaken);
    return () => form.removeEventListener(REGISTER_CONTACT_TAKEN_EVENT, onTaken);
  }, [inputRef, field]);

  const clear = React.useCallback(() => setMessage(null), []);
  return [message, clear];
}
