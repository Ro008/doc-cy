import { expect, test } from "@playwright/test";

import { buildDoctorRegistrationReceivedEmailContent } from "@/lib/send-doctor-registration-received-email";
import { buildPasswordResetEmailContent } from "@/lib/send-password-reset-email";

test.describe("Doctor onboarding email content", { tag: "@pr-email" }, () => {
  test("doctor registration received email asks them to confirm with a magic link", () => {
    const content = buildDoctorRegistrationReceivedEmailContent({
      doctorName: "Maria Papadopoulos",
      confirmUrl: "https://www.mydoccy.com/auth/confirm-email?token_hash=tok&type=magiclink",
    });

    expect(content.subject).toBe("[DocCy] We received your application");
    expect(content.text).toContain("Hi Maria");
    expect(content.text).toContain("received your application");
    expect(content.text).toContain("not a code");
    expect(content.text).toContain("/auth/confirm-email");
    expect(content.text).toContain("another email when your account is ready to sign in");
    expect(content.html).toContain("Confirm your email");
    expect(content.html.toLowerCase()).not.toContain("/agenda");
    expect(content.html.toLowerCase()).not.toContain("otp");
  });

  test("password reset email is branded as DocCy", () => {
    const content = buildPasswordResetEmailContent({
      resetUrl: "https://www.mydoccy.com/auth/callback?token_hash=tok&type=recovery",
    });
    expect(content.subject).toBe("[DocCy] Reset your password");
    expect(content.text).toContain("DocCy practitioner account");
    expect(content.html).toContain("Choose a new password");
    expect(content.html.toLowerCase()).not.toContain("supabase");
  });
});
