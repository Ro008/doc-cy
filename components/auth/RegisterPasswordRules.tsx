"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { passwordRuleChecks } from "@/lib/password-policy";

/**
 * Live password checklist under the register password field: each rule ticks
 * as it is met, so nobody has to guess which one is still missing.
 */
export function RegisterPasswordRules({ formId }: { formId: string }) {
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const onInput = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.name === "password") {
        setValue(target.value);
      }
    };
    form.addEventListener("input", onInput, true);
    return () => form.removeEventListener("input", onInput, true);
  }, [formId]);

  return (
    <ul
      data-testid="register-password-rules"
      aria-label="Password must include"
      className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs"
    >
      {passwordRuleChecks(value).map((rule) => (
        <li
          key={rule.key}
          data-rule={rule.key}
          data-met={rule.met ? "1" : "0"}
          className={`inline-flex items-center gap-1 ${
            rule.met ? "font-semibold text-wellness-700" : "text-ink-500"
          }`}
        >
          {rule.met ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-ink-300" aria-hidden />
          )}
          {rule.label}
          <span className="sr-only">{rule.met ? " (done)" : " (missing)"}</span>
        </li>
      ))}
    </ul>
  );
}
