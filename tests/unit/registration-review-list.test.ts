import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reviewCardsWithRecentDecisions } from "../../lib/registration-review-list";

const item = (id: string, status: string) => ({ id, status });

describe("reviewCardsWithRecentDecisions", () => {
  it("lists pending requests as open cards", () => {
    const cards = reviewCardsWithRecentDecisions([item("a", "pending"), item("b", "approved")], {});
    assert.deepEqual(
      cards.map((c) => [c.item.id, c.decision]),
      [["a", null]],
    );
  });

  it("keeps a request decided in this session in its place, with the decision", () => {
    // After approving, the refreshed list says "approved"; the card must not vanish.
    const cards = reviewCardsWithRecentDecisions(
      [item("a", "pending"), item("b", "approved"), item("c", "pending"), item("d", "rejected")],
      {
        b: { decision: "approved", item: item("b", "pending"), position: 1 },
        d: { decision: "denied", item: item("d", "pending"), position: 3 },
      },
    );
    assert.deepEqual(
      cards.map((c) => [c.item.id, c.decision]),
      [
        ["a", null],
        ["b", "approved"],
        ["c", null],
        ["d", "denied"],
      ],
    );
  });

  it("shows the decision even before the refreshed list arrives", () => {
    const cards = reviewCardsWithRecentDecisions([item("a", "pending")], {
      a: { decision: "approved", item: item("a", "pending"), position: 0 },
    });
    assert.deepEqual(cards.map((c) => [c.item.id, c.decision]), [["a", "approved"]]);
  });

  it("keeps the card where it was when the refreshed list leaves the request out", () => {
    // Decisions on automated-test addresses are not listed after the refresh.
    const cards = reviewCardsWithRecentDecisions([item("a", "pending"), item("c", "pending")], {
      b: { decision: "approved", item: item("b", "pending"), position: 1 },
    });
    assert.deepEqual(
      cards.map((c) => [c.item.id, c.decision]),
      [
        ["a", null],
        ["b", "approved"],
        ["c", null],
      ],
    );
  });

  it("leaves older decisions to the collapsed history", () => {
    const cards = reviewCardsWithRecentDecisions([item("x", "approved"), item("y", "withdrawn")], {});
    assert.deepEqual(cards, []);
  });
});
