import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { backendPendingMessage } from "../../lib/settings-backend-pending";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_EMAILS,
  validateExtraEmail,
} from "../../lib/settings-notifications";
import { SETTINGS_SECTIONS } from "../../lib/settings-sections";

/**
 * Settings → Notifications (user, 2026-10-01): which emails the professional gets,
 * a second address (e.g. reception), and a reminder to patients. Nothing is
 * configurable on the server yet: the defaults are what DocCy does today, and saving
 * waits for Livio's PUT /api/doctor-notification-settings.
 */

describe("notification defaults", () => {
  it("match what DocCy sends today", () => {
    assert.deepEqual(DEFAULT_NOTIFICATION_SETTINGS, {
      emails: { newRequest: true, confirmedCopy: true, dailySummary: false, monthlySummary: true },
      extraEmail: "",
      patientReminder: { enabled: false, hoursBefore: 24 },
    });
  });

  it("names every email the professional can turn on or off", () => {
    assert.deepEqual(
      NOTIFICATION_EMAILS.map((email) => email.key),
      ["newRequest", "confirmedCopy", "dailySummary", "monthlySummary"],
    );
    for (const email of NOTIFICATION_EMAILS) {
      assert.ok(email.label.length > 0 && email.hint.length > 0, email.key);
    }
  });
});

describe("validateExtraEmail", () => {
  it("accepts an empty field (no second address)", () => {
    assert.equal(validateExtraEmail("  ", "dr@example.com"), null);
  });

  it("needs a real address", () => {
    assert.equal(validateExtraEmail("reception@", "dr@example.com"), "Enter a valid email address.");
  });

  it("refuses the account's own address", () => {
    assert.equal(
      validateExtraEmail(" DR@example.com ", "dr@example.com"),
      "That is already your account email.",
    );
  });

  it("accepts another address", () => {
    assert.equal(validateExtraEmail("reception@clinic.cy", "dr@example.com"), null);
  });
});

describe("Notifications section", () => {
  it("sits after Contact & phone", () => {
    const ids = SETTINGS_SECTIONS.map((s) => s.id);
    assert.equal(ids.indexOf("notifications"), ids.indexOf("contact") + 1);
  });

  it("says saving waits for Livio's endpoint", () => {
    assert.equal(
      backendPendingMessage("notificationSettings"),
      "Expected to fail for now: saving notification settings works once Livio builds it in the backend (PUT /api/doctor-notification-settings).",
    );
  });
});
