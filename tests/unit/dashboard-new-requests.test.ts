import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyRealtimeRequestChange,
  freshlyShownIds,
  newRequestsCount,
  newRequestsLabel,
  serverExtraCount,
} from "../../lib/dashboard-new-requests";

// 2026-09-25 is summer time in Cyprus (UTC+3): 06:50Z is 09:50 local.
const NOW = Date.parse("2026-09-25T06:50:00Z");
const FUTURE = "2026-09-29T07:30:00Z";
const PAST = "2026-09-25T06:00:00Z";

describe("applyRealtimeRequestChange", () => {
  it("adds a future request", () => {
    const next = applyRealtimeRequestChange(new Set(), { id: "a", status: "REQUESTED", appointment_datetime: FUTURE }, NOW);
    assert.deepEqual([...next], ["a"]);
  });

  it("matches the status case-insensitively", () => {
    const next = applyRealtimeRequestChange(new Set(), { id: "a", status: "requested", appointment_datetime: FUTURE }, NOW);
    assert.deepEqual([...next], ["a"]);
  });

  it("ignores a request for a time already gone", () => {
    const before = new Set<string>();
    const next = applyRealtimeRequestChange(before, { id: "a", status: "REQUESTED", appointment_datetime: PAST }, NOW);
    assert.equal(next, before);
  });

  it("ignores other statuses that were never counted", () => {
    const before = new Set<string>();
    for (const status of ["CONFIRMED", "NEEDS_RESCHEDULE", "DECLINED", "CANCELLED", "EXPIRED"]) {
      assert.equal(applyRealtimeRequestChange(before, { id: "a", status, appointment_datetime: FUTURE }, NOW), before);
    }
  });

  it("drops a counted request once it is handled elsewhere", () => {
    const next = applyRealtimeRequestChange(
      new Set(["a", "b"]),
      { id: "a", status: "CONFIRMED", appointment_datetime: FUTURE },
      NOW,
    );
    assert.deepEqual([...next], ["b"]);
  });

  it("keeps the same set when a counted request is repeated", () => {
    const before = new Set(["a"]);
    const next = applyRealtimeRequestChange(before, { id: "a", status: "REQUESTED", appointment_datetime: FUTURE }, NOW);
    assert.equal(next, before);
  });

  it("ignores payloads without an id or a valid time", () => {
    const before = new Set<string>();
    assert.equal(applyRealtimeRequestChange(before, null, NOW), before);
    assert.equal(applyRealtimeRequestChange(before, { status: "REQUESTED", appointment_datetime: FUTURE }, NOW), before);
    assert.equal(applyRealtimeRequestChange(before, { id: "a", status: "REQUESTED", appointment_datetime: "soon" }, NOW), before);
  });
});

describe("serverExtraCount", () => {
  it("is how many more the server has than were on screen when it answered", () => {
    assert.equal(serverExtraCount(5, 2), 3);
  });

  it("never goes below zero when the server has fewer (handled in another tab)", () => {
    assert.equal(serverExtraCount(0, 2), 0);
  });

  it("is zero when the check failed", () => {
    assert.equal(serverExtraCount(null, 2), 0);
  });
});

describe("newRequestsCount", () => {
  it("counts arrivals not on screen yet", () => {
    assert.equal(newRequestsCount({ arrivedIds: new Set(["a", "b", "c"]), shownIds: new Set(["a"]), serverExtra: 0 }), 2);
  });

  it("uses the server extra when Realtime missed something", () => {
    assert.equal(newRequestsCount({ arrivedIds: new Set(), shownIds: new Set(["a", "b"]), serverExtra: 3 }), 3);
  });

  it("takes the larger of the two signals instead of adding them", () => {
    assert.equal(newRequestsCount({ arrivedIds: new Set(["c"]), shownIds: new Set(["a", "b"]), serverExtra: 1 }), 1);
  });

  it("is not raised by answering a request after the check (the extra is fixed when it arrives)", () => {
    assert.equal(newRequestsCount({ arrivedIds: new Set(), shownIds: new Set(["a"]), serverExtra: 0 }), 0);
  });
});

describe("freshlyShownIds", () => {
  it("returns the rows that were not on screen before the refresh", () => {
    assert.deepEqual(freshlyShownIds(new Set(["a", "b"]), ["a", "c", "b", "d"]), ["c", "d"]);
  });

  it("is empty when nothing new came in", () => {
    assert.deepEqual(freshlyShownIds(new Set(["a"]), ["a"]), []);
  });
});

describe("newRequestsLabel", () => {
  it("says request for one and requests for more", () => {
    assert.equal(newRequestsLabel(1), "1 new request");
    assert.equal(newRequestsLabel(3), "3 new requests");
  });
});
