import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MISSED_REQUESTS_DISMISSED_KEY,
  missedRequestSummary,
  selectMissedRequests,
} from "../../lib/missed-requests";

/**
 * Dashboard "Missed requests" (user, 2026-10-08): booking requests nobody answered before their
 * time, from the last 7 days, so she can still call the patient. Lapsed proposals are not these
 * (they have proposal_expires_at and are listed under "No new time chosen").
 */
const NOW = Date.parse("2026-10-08T10:00:00Z");
const row = (id: string, status: string, appointment_datetime: string, proposal_expires_at: string | null = null) => ({
  id,
  status,
  appointment_datetime,
  proposal_expires_at,
});

describe("selectMissedRequests", () => {
  it("lists requests that expired unanswered, newest first", () => {
    const rows = [
      row("old", "EXPIRED", "2026-10-05T07:00:00Z"),
      row("new", "EXPIRED", "2026-10-08T09:26:00Z"),
    ];
    assert.deepEqual(selectMissedRequests(rows, NOW).map((r) => r.id), ["new", "old"]);
  });

  it("counts a waiting request whose time has passed before the job runs", () => {
    assert.deepEqual(selectMissedRequests([row("late", "REQUESTED", "2026-10-08T09:00:00Z")], NOW).map((r) => r.id), ["late"]);
  });

  it("leaves out future requests, lapsed proposals, other statuses and anything older than 7 days", () => {
    const rows = [
      row("future", "REQUESTED", "2026-10-09T09:00:00Z"),
      row("proposal", "EXPIRED", "2026-10-07T09:00:00Z", "2026-10-07T06:00:00Z"),
      row("declined", "DECLINED", "2026-10-07T09:00:00Z"),
      row("confirmed", "CONFIRMED", "2026-10-07T09:00:00Z"),
      row("tooOld", "EXPIRED", "2026-09-30T09:00:00Z"),
    ];
    assert.deepEqual(selectMissedRequests(rows, NOW), []);
  });

  it("hides the ones closed on this device", () => {
    const rows = [row("a", "EXPIRED", "2026-10-08T09:00:00Z"), row("b", "EXPIRED", "2026-10-07T09:00:00Z")];
    assert.deepEqual(selectMissedRequests(rows, NOW, new Set(["a"])).map((r) => r.id), ["b"]);
  });

  it("uses its own device key, apart from No new time chosen", () => {
    assert.equal(MISSED_REQUESTS_DISMISSED_KEY, "doccy:dashboard:missed-requests-dismissed");
  });
});

describe("missedRequestSummary", () => {
  it("gives the requested time in Cyprus and a tap-to-call link", () => {
    assert.deepEqual(missedRequestSummary({ appointment_datetime: "2026-10-08T12:00:00Z", patient_phone: "+357 99 123 456" }), {
      requestedLabel: "Thu 8 Oct, 15:00",
      call: { label: "+357 99 123 456", href: "tel:+35799123456" },
    });
  });

  it("no call link without a usable phone", () => {
    assert.equal(missedRequestSummary({ appointment_datetime: "2026-10-08T12:00:00Z", patient_phone: "" }).call, null);
  });
});
