import { expect, test } from "@playwright/test";

import { buildDoctorRegistrationReceivedEmailContent } from "@/lib/send-doctor-registration-received-email";
import { buildDoctorAccountRejectedEmailContent } from "@/lib/send-doctor-account-rejected-email";
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

  test("doctor application rejected email points at the support form", () => {
    const license = buildDoctorAccountRejectedEmailContent({
      doctorName: "Maria Papadopoulos",
      reason: "license",
      siteUrl: "https://mydoccy.com",
    });
    expect(license.subject).toBe("[DocCy] Your application was not approved");
    expect(license.text).toContain("Hi Maria");
    expect(license.text).toContain("could not verify your professional license");
    expect(license.text).toContain("If you believe this is a mistake");
    expect(license.supportUrl).toBe("https://mydoccy.com/?support=application-review");
    expect(license.html).toContain("Open the support form");
    expect(license.html).toContain("support=application-review");

    const specialty = buildDoctorAccountRejectedEmailContent({
      doctorName: "Alex Other",
      reason: "specialty",
      siteUrl: "https://mydoccy.com",
    });
    expect(specialty.text).toContain("cannot include it on DocCy");
    expect(specialty.text).toContain("If you think we misunderstood your practice");
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
