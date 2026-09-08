/**
 * Shared shape for Playwright doctor registration E2E + optional dev-only Admin API signup bypass
 * (see `shouldUseAdminAuthForAutomatedRegistration` in `app/register/page.tsx`).
 */
export const E2E_DOCTOR_REGISTRATION_LOCAL_PREFIX = "test-registration-e2e-avatar-";
export const E2E_DOCTOR_REGISTRATION_DOMAIN_DEFAULT = "test-doccy.com.cy";

/** Playwright custom event to confirm clinic without Google Places (CI / local only). */
export const E2E_REGISTER_CLINIC_EVENT = "doccy-e2e-register-clinic";

export const E2E_REGISTER_NAME_PREFIX = "Register E2E ";
export const E2E_REGISTER_SLUG_PREFIX = "register-e2e-";

export const E2E_REGISTER_CLINIC_LOCATION = {
  address: "Archiepiskopou Makariou III, Nicosia 1065, Cyprus",
  latitude: 35.1856,
  longitude: 33.3823,
  placeId: "e2e-register-clinic-nicosia",
  district: "Nicosia" as const,
  town: "Nicosia",
};

export function e2eRegisterHooksEnabled(): boolean {
  return String(process.env.NEXT_PUBLIC_DOC_CY_E2E_REGISTER_HOOKS ?? "").trim() === "1";
}

export function buildAutomatedDoctorRegistrationTestEmail(): string {
  const domain =
    process.env.PLAYWRIGHT_REGISTER_EMAIL_DOMAIN?.trim().replace(/^@/, "") ||
    E2E_DOCTOR_REGISTRATION_DOMAIN_DEFAULT;
  return `${E2E_DOCTOR_REGISTRATION_LOCAL_PREFIX}${Date.now()}@${domain}`;
}

/** Same address shape accepted by the dev-only admin-create path (default domain only). */
export function matchesAutomatedDoctorRegistrationTestEmailForAdminBypass(email: string): boolean {
  const t = email.trim().toLowerCase();
  if (!t.endsWith(`@${E2E_DOCTOR_REGISTRATION_DOMAIN_DEFAULT}`)) return false;
  const local = t.slice(0, t.indexOf("@"));
  if (!local.startsWith(E2E_DOCTOR_REGISTRATION_LOCAL_PREFIX)) return false;
  const digits = local.slice(E2E_DOCTOR_REGISTRATION_LOCAL_PREFIX.length);
  return /^\d{10,}$/.test(digits);
}
