"use client";

import { registerContactMessages, type ProfessionalContactUse } from "@/lib/professional-contact";

/** Fired on the form with `{ email, mobile }` messages (null = free) after each check. */
export const REGISTER_CONTACT_TAKEN_EVENT = "doccy-register-contact-taken";

export type RegisterContactTakenDetail = { email: string | null; mobile: string | null };

/**
 * Account step: asks the server whether the email or mobile is already another
 * professional's, shows the answer on the fields, and returns true when the step
 * must stop. A failed check lets the applicant continue: the submit checks again.
 */
export async function registerContactBlocksAccountStep(form: HTMLFormElement): Promise<boolean> {
  const email = form.querySelector<HTMLInputElement>("input[name='email']")?.value.trim() ?? "";
  const mobile = form.querySelector<HTMLInputElement>("input[name='phone']")?.value.trim() ?? "";
  if (!email && !mobile) return false;

  let messages: RegisterContactTakenDetail;
  try {
    const response = await fetch("/api/register/contact-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, mobile }),
    });
    if (!response.ok) return false;
    // The route answers `{ email, mobile }` (a ProfessionalContactUse).
    const body = (await response.json()) as Partial<ProfessionalContactUse>;
    messages = registerContactMessages({
      email: body.email === "professional" || body.email === "account" ? body.email : null,
      mobile: body.mobile === true,
    });
  } catch {
    return false;
  }

  form.dispatchEvent(
    new CustomEvent<RegisterContactTakenDetail>(REGISTER_CONTACT_TAKEN_EVENT, { detail: messages }),
  );
  if (!messages.email && !messages.mobile) return false;

  const target = messages.email
    ? form.querySelector<HTMLInputElement>("input[name='email']")
    : form.querySelector<HTMLInputElement>("[data-testid='register-phone-input']");
  target?.focus();
  return true;
}
