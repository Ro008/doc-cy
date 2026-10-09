import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expandAgendaAppointmentsForGrid } from "../../lib/agenda-grid";

const NOW = Date.parse("2026-09-27T09:00:00Z"); // 12:00 in Cyprus

function row(overrides: Record<string, unknown>) {
  return {
    id: "a1",
    appointment_datetime: "2026-09-28T09:00:00Z",
    status: "CONFIRMED",
    proposed_slots: null,
    proposal_expires_at: null,
    ...overrides,
  };
}

describe("expandAgendaAppointmentsForGrid", () => {
  it("shows requests and confirmed visits at their own time", () => {
    const out = expandAgendaAppointmentsForGrid(
      [row({ id: "c" }), row({ id: "r", status: "REQUESTED" })],
      NOW,
    );
    assert.deepEqual(
      out.map((r) => [r.rowKey, r.gridStartIso, r.isCounterOfferHold]),
      [
        ["c", "2026-09-28T09:00:00Z", false],
        ["r", "2026-09-28T09:00:00Z", false],
      ],
    );
  });

  it("shows a live counter-offer at each proposed time, not at the original time", () => {
    const out = expandAgendaAppointmentsForGrid(
      [
        row({
          id: "p",
          status: "NEEDS_RESCHEDULE",
          proposed_slots: ["2026-09-29T07:00:00Z", "2026-09-30T08:00:00Z"],
          proposal_expires_at: "2026-09-28T06:00:00Z",
        }),
      ],
      NOW,
    );
    assert.deepEqual(
      out.map((r) => [r.rowKey, r.gridStartIso, r.isCounterOfferHold]),
      [
        ["p-proposal-0", "2026-09-29T07:00:00Z", true],
        ["p-proposal-1", "2026-09-30T08:00:00Z", true],
      ],
    );
  });

  it("drops a counter-offer the patient let expire: it holds no time any more", () => {
    const out = expandAgendaAppointmentsForGrid(
      [
        row({
          id: "lapsed",
          status: "NEEDS_RESCHEDULE",
          proposed_slots: ["2026-09-29T07:00:00Z"],
          proposal_expires_at: "2026-09-26T06:00:00Z",
        }),
        row({ id: "lapsed-lowercase", status: "needs_reschedule", proposal_expires_at: "2026-09-27T09:00:00Z" }),
        row({ id: "no-expiry", status: "NEEDS_RESCHEDULE", proposal_expires_at: null }),
        row({ id: "kept" }),
      ],
      NOW,
    );
    assert.deepEqual(out.map((r) => r.rowKey), ["kept"]);
  });

  it("keeps a live counter-offer with no readable proposed times at its original time", () => {
    const out = expandAgendaAppointmentsForGrid(
      [row({ id: "p", status: "NEEDS_RESCHEDULE", proposed_slots: [42], proposal_expires_at: "2026-09-28T06:00:00Z" })],
      NOW,
    );
    assert.deepEqual(out.map((r) => [r.rowKey, r.gridStartIso]), [["p", "2026-09-28T09:00:00Z"]]);
  });
});
