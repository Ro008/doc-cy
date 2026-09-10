import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateBookingRequestStats,
  formatFinderRequestBadgeLabel,
  mergeManualDirectoryRowsById,
  professionalIdsWithUniqueRequests,
} from "@/lib/finder-booking-request-stats";

describe("finder booking request stats", () => {
  it("counts every tap internally and unique patients for the badge/ranking", () => {
    const stats = aggregateBookingRequestStats([
      { professionalId: "a", id: "1", voterKey: "voter-1" },
      { professionalId: "a", id: "2", voterKey: "voter-1" },
      { professionalId: "a", id: "3", voterKey: "voter-2" },
      { professionalId: "b", id: "4", voterKey: null },
    ]);
    assert.deepEqual(stats.get("a"), { requestTaps: 3, uniquePatients: 2 });
    assert.deepEqual(stats.get("b"), { requestTaps: 1, uniquePatients: 1 });
  });

  it("formats the scarcity badge without a time window and hides zero", () => {
    assert.equal(formatFinderRequestBadgeLabel(0), null);
    assert.equal(
      formatFinderRequestBadgeLabel(1),
      "🔥 1 patient requested online booking",
    );
    assert.equal(
      formatFinderRequestBadgeLabel(4),
      "🔥 4 patients requested online booking",
    );
  });

  it("lists listing ids that have unique patients", () => {
    const stats = aggregateBookingRequestStats([
      { professionalId: "hot", id: "1", voterKey: "v1" },
      { professionalId: "hot", id: "2", voterKey: "v2" },
      { professionalId: "one", id: "3", voterKey: "v3" },
    ]);
    assert.deepEqual(
      professionalIdsWithUniqueRequests(stats).sort(),
      ["hot", "one"],
    );
    assert.deepEqual(professionalIdsWithUniqueRequests(stats, 2), ["hot"]);
  });

  it("merges listing batches without duplicating ids", () => {
    assert.deepEqual(
      mergeManualDirectoryRowsById([
        [{ id: "requested", name: "A" }],
        [{ id: "page", name: "B" }, { id: "requested", name: "A-dup" }],
      ]),
      [
        { id: "requested", name: "A" },
        { id: "page", name: "B" },
      ],
    );
  });
});
