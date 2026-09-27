import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REGISTRATION_STATUS_PATH,
  agendaRedirectForLogin,
  registrationStatusFromRequests,
} from "../../lib/registration-status";

/**
 * A signed-in applicant without a professional profile (pending or denied) sees
 * only the Status page: every /agenda page sends them there, and the Status page
 * sends a professional back to the agenda.
 */

describe("agendaRedirectForLogin", () => {
  it("sends a login without a professional to the Status page", () => {
    assert.equal(agendaRedirectForLogin("/agenda", false), REGISTRATION_STATUS_PATH);
    assert.equal(agendaRedirectForLogin("/agenda/settings", false), REGISTRATION_STATUS_PATH);
    assert.equal(agendaRedirectForLogin("/agenda/insights", false), REGISTRATION_STATUS_PATH);
    assert.equal(REGISTRATION_STATUS_PATH, "/agenda/status");
  });

  it("leaves the Status page itself alone", () => {
    assert.equal(agendaRedirectForLogin("/agenda/status", false), null);
  });

  it("sends a professional from the Status page to the agenda, and nowhere else", () => {
    assert.equal(agendaRedirectForLogin("/agenda/status", true), "/agenda");
    assert.equal(agendaRedirectForLogin("/agenda", true), null);
    assert.equal(agendaRedirectForLogin("/agenda/settings", true), null);
  });
});

describe("registrationStatusFromRequests", () => {
  const pending = {
    status: "pending",
    created_at: "2026-09-27T10:00:00Z",
    decided_at: null,
    decision_note: null,
  };
  const denied = {
    status: "rejected",
    created_at: "2026-09-20T10:00:00Z",
    decided_at: "2026-09-21T09:00:00Z",
    decision_note: "Licence number not found",
  };

  it("shows the latest request", () => {
    assert.deepEqual(registrationStatusFromRequests([denied, pending]), {
      kind: "pending",
      submittedAt: "2026-09-27T10:00:00Z",
    });
    assert.deepEqual(registrationStatusFromRequests([denied]), {
      kind: "denied",
      decidedAt: "2026-09-21T09:00:00Z",
      reason: "Licence number not found",
    });
  });

  it("treats a withdrawn request as withdrawn, and no request as none", () => {
    assert.deepEqual(
      registrationStatusFromRequests([{ ...denied, status: "withdrawn", decision_note: null }]),
      { kind: "withdrawn", decidedAt: "2026-09-21T09:00:00Z" },
    );
    assert.deepEqual(registrationStatusFromRequests([]), { kind: "none" });
  });

  it("treats an approved request whose profile is gone as none", () => {
    assert.deepEqual(
      registrationStatusFromRequests([{ ...denied, status: "approved", decision_note: null }]),
      { kind: "none" },
    );
  });
});
