import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildManualVoteDashboardRows } from "../../lib/founder-manual-votes";

describe("buildManualVoteDashboardRows", () => {
  it("fills in professional metadata and coerces numeric-string counts", () => {
    const rows = buildManualVoteDashboardRows(
      [{ professional_id: "m1", vote_count: "3", last_at: "2026-08-02T10:00:00.000Z" }],
      new Map([["m1", { name: "Vera Politou", district: "Paphos", specialty: "Dentist" }]]),
    );
    assert.deepEqual(rows, [
      {
        manualId: "m1",
        name: "Vera Politou",
        district: "Paphos",
        specialty: "Dentist",
        count: 3,
        lastAt: "2026-08-02T10:00:00.000Z",
      },
    ]);
  });

  it("falls back to a truncated id when the professional has no name on file", () => {
    const rows = buildManualVoteDashboardRows(
      [{ professional_id: "0123456789abcdef", vote_count: 1, last_at: null }],
      new Map(),
    );
    assert.equal(rows[0]?.name, "01234567");
    assert.equal(rows[0]?.lastAt, "");
  });

  it("treats a non-numeric vote_count as zero rather than NaN", () => {
    const rows = buildManualVoteDashboardRows(
      [{ professional_id: "m1", vote_count: null, last_at: null }],
      new Map(),
    );
    assert.equal(rows[0]?.count, 0);
  });
});
