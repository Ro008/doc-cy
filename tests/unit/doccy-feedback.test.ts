import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  consumePendingOpenFeedback,
  emitOpenFeedback,
} from "@/lib/doccy-feedback";

describe("open-feedback pending queue", () => {
  it("keeps a click until the lazy widget consumes it", () => {
    consumePendingOpenFeedback();
    emitOpenFeedback({ subject: "General Question", message: "Hello" });
    assert.deepEqual(consumePendingOpenFeedback(), {
      subject: "General Question",
      message: "Hello",
    });
    assert.equal(consumePendingOpenFeedback(), null);
  });
});
