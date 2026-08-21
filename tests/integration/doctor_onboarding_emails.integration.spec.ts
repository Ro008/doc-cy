import { expect, test } from "@playwright/test";

import { buildFounderNewRegistrationNotifyContent } from "@/lib/notify-founder-new-registration";
import { buildDoctorAccountVerifiedEmailContent } from "@/lib/send-doctor-account-verified-email";

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
  });

  test("doctor account verified email includes login link to agenda and setup guidance", () => {
    const content = buildDoctorAccountVerifiedEmailContent({
      siteUrl: "https://mydoccy.com",
      doctorName: "Maria Papadopoulos",
    });

    expect(content.subject).toBe("[DocCy] Your account is ready");
    expect(content.loginUrl).toContain("/login");
    expect(content.loginUrl).toContain("next=%2Fagenda");
    expect(content.text).toContain("Hi Maria");
    expect(content.text).toContain("email and password you used when registering");
    expect(content.text).toContain("working hours, appointment types");
    expect(content.html).toContain("Open your dashboard");
    expect(content.html).toContain(encodeURIComponent("/agenda"));
  });
});
