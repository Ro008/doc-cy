import { buildAutomatedDoctorRegistrationTestEmail } from "@/lib/e2e-doctor-registration-test";

/**
 * Email for Playwright doctor registration (`signUp` or dev-only admin-create bypass).
 *
 * Override domain if needed (public `signUp` must accept it):
 *   PLAYWRIGHT_REGISTER_EMAIL_DOMAIN=your-verified-domain.com
 */
export function doctorRegisterTestEmail(): string {
  return buildAutomatedDoctorRegistrationTestEmail();
}
