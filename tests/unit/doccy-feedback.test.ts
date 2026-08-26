import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSpecialtyChangeFeedbackMessage,
  consumePendingOpenFeedback,
  DOCCY_FEEDBACK_SUBJECT_SPECIALTY_CHANGE,
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

  it("builds a specialty-change prefill with the current specialty", () => {
    const message = buildSpecialtyChangeFeedbackMessage("Psychology");
    assert.match(message, /Current specialty: Psychology/);
    assert.match(message, /Requested specialty:/);
    assert.match(message, /License \/ certification number:/);
    assert.equal(DOCCY_FEEDBACK_SUBJECT_SPECIALTY_CHANGE, "Specialty change request");
  });
});
