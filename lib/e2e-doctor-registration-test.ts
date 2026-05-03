/**
 * Shared shape for Playwright doctor registration E2E + optional dev-only Admin API signup bypass
 * (see `shouldUseAdminAuthForAutomatedRegistration` in `app/register/page.tsx`).
 */
export const E2E_DOCTOR_REGISTRATION_LOCAL_PREFIX = "test-registration-e2e-avatar-";
export const E2E_DOCTOR_REGISTRATION_DOMAIN_DEFAULT = "test-doccy.com.cy";

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
