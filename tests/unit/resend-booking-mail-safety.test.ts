import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getResendFrom } from "@/lib/resend";

/**
 * Booking / confirmation / digest mail is the product core.
 * Outreach may set From + Reply-To; every other Resend caller must not.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const OUTREACH_SENDER = "lib/send-directory-manual-outreach-email.ts";

const CORE_SEND_FILES = [
  "lib/send-patient-appointment-confirmed-email.ts",
  "lib/send-patient-confirmed-appointment-cancelled-email.ts",
  "lib/send-patient-request-declined-email.ts",
  "lib/send-patient-reschedule-proposal-email.ts",
  "lib/send-doctor-appointment-confirmed-email.ts",
  "lib/send-doctor-account-verified-email.ts",
  "lib/send-doctor-monthly-digest-email.ts",
  "lib/notify-founder-new-registration.ts",
  "lib/run-finder-traffic-alert-job.ts",
  "app/api/appointments/route.ts",
  "app/api/appointments/manual/route.ts",
  "app/api/auth/session-audit/route.ts",
];

function readRepoFile(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("Resend booking mail stays no-reply", () => {
  it("defaults From to DocCy no-reply on the verified domain", () => {
    const previous = process.env.RESEND_FROM;
    delete process.env.RESEND_FROM;
    try {
      assert.equal(getResendFrom(), "DocCy <no-reply@mydoccy.com>");
    } finally {
      if (previous === undefined) delete process.env.RESEND_FROM;
      else process.env.RESEND_FROM = previous;
    }
  });

  it("only adds replyTo/from/headers when the caller sets them", () => {
    const source = readRepoFile("lib/resend.ts");
    assert.match(source, /from: email\.from\?\.trim\(\) \|\| getResendFrom\(\)/);
    assert.match(source, /\.\.\.\(email\.replyTo \? \{ replyTo: email\.replyTo \} : \{\}\)/);
    assert.match(source, /\.\.\.\(email\.headers \? \{ headers: email\.headers \} : \{\}\)/);
  });

  it("does not pass from, replyTo, or custom headers from booking/digest senders", () => {
    for (const rel of CORE_SEND_FILES) {
      const source = readRepoFile(rel);
      assert.equal(source.includes("replyTo:"), false, `${rel} must not set replyTo`);
      assert.equal(
        source.includes("getDirectoryOutreachFrom"),
        false,
        `${rel} must not use the outreach From`,
      );
      assert.equal(
        source.includes("List-Unsubscribe"),
        false,
        `${rel} must not add outreach List-Unsubscribe headers`,
      );
      if (source.includes("sendResendEmail(")) {
        assert.equal(
          /^\s*from:\s/m.test(source),
          false,
          `${rel} must not override From on sendResendEmail`,
        );
      }
    }
  });

  it("keeps From/Reply-To overrides on the directory outreach sender only", () => {
    const source = readRepoFile(OUTREACH_SENDER);
    assert.match(source, /from: getDirectoryOutreachFrom\(\)/);
    assert.match(source, /replyTo: opts\.replyTo/);
    assert.equal(source.includes("List-Unsubscribe"), false);
  });
});
