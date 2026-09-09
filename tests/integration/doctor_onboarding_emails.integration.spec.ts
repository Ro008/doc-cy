import { expect, test } from "@playwright/test";

import { buildFounderNewRegistrationNotifyContent } from "@/lib/notify-founder-new-registration";
import { buildDoctorAccountVerifiedEmailContent } from "@/lib/send-doctor-account-verified-email";
import { buildDoctorRegistrationReceivedEmailContent } from "@/lib/send-doctor-registration-received-email";
import { buildDoctorAccountRejectedEmailContent } from "@/lib/send-doctor-account-rejected-email";
import { buildPasswordResetEmailContent } from "@/lib/send-password-reset-email";

test.describe("Doctor onboarding email content", { tag: "@pr-email" }, () => {
  test("founder new registration alert includes review link and custom specialty note", () => {
    const standard = buildFounderNewRegistrationNotifyContent(
      {
        doctorId: "doc-1",
        fullName: "Maria Papadopoulos",
        email: "maria@example.com",
        phone: "+35799111222",
        specialty: "General Practice",
        needsSpecialtyReview: false,
      },
      "https://mydoccy.com",
    );
    expect(standard.subject).toBe("[DocCy] New registration — Maria Papadopoulos");
    expect(standard.textBody).toContain("doc-1");
    expect(standard.textBody).toContain("maria@example.com");
    expect(standard.reviewUrl).toBe("https://mydoccy.com/internal/directory");

    const custom = buildFounderNewRegistrationNotifyContent(
      {
        doctorId: "doc-2",
        fullName: "Alex Other",
        email: "alex@example.com",
        phone: "+35799222333",
        specialty: "Reiki",
        needsSpecialtyReview: true,
      },
      "https://mydoccy.com",
    );
    expect(custom.textBody).toContain("custom specialty pending your approval");

    const claimed = buildFounderNewRegistrationNotifyContent(
      {
        doctorId: "listing-1",
        fullName: "Ioanna Severi",
        email: "ioanna@example.com",
        phone: "+35799333444",
        specialty: "Dentist",
        needsSpecialtyReview: false,
        claimedDirectory: true,
      },
      "https://mydoccy.com",
    );
    expect(claimed.subject).toBe("[DocCy] Finder listing claimed — Ioanna Severi");
    expect(claimed.textBody).toContain("claimed their existing finder listing");
    expect(claimed.textBody).toContain("listing-1");
  });

  test("doctor registration received email confirms review is pending", () => {
    const content = buildDoctorRegistrationReceivedEmailContent({
      doctorName: "Maria Papadopoulos",
    });

    expect(content.subject).toBe("[DocCy] We received your application");
    expect(content.text).toContain("Hi Maria");
    expect(content.text).toContain("received your application");
    expect(content.text).toContain("another email when your account is ready to sign in");
    expect(content.html).toContain("We received your application");
    expect(content.html.toLowerCase()).not.toContain("/agenda");
    expect(content.html.toLowerCase()).not.toContain("/login");
  });

  test("doctor account verified email points at sign-in, then agenda", () => {
    const content = buildDoctorAccountVerifiedEmailContent({
      siteUrl: "https://mydoccy.com",
      doctorName: "Maria Papadopoulos",
    });

    expect(content.subject).toBe("[DocCy] Your account is ready — sign in");
    expect(content.loginUrl).toContain("/login");
    expect(content.loginUrl).toContain("next=%2Fagenda");
    expect(content.text).toContain("Hi Maria");
    expect(content.text).toContain("Sign in:");
    expect(content.text).toContain("email and password you used when registering");
    expect(content.text.toLowerCase()).not.toContain("open your dashboard");
    expect(content.html).toContain("Sign in to DocCy");
    expect(content.html).not.toContain("Open your dashboard");
    expect(content.html).toContain(encodeURIComponent("/agenda"));
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
