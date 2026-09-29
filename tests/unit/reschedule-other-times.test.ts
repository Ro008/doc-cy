import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  rescheduleOtherTimeErrorMessage,
  rescheduleRequestOtherTimePath,
} from "../../lib/reschedule-other-times";

describe("rescheduleRequestOtherTimePath", () => {
  it("is the contract endpoint for this appointment", () => {
    assert.equal(
      rescheduleRequestOtherTimePath("3bfb41e2-c5aa-41cb-81ea-89293e3ff5e3"),
      "/api/reschedule/3bfb41e2-c5aa-41cb-81ea-89293e3ff5e3/request-other-time",
    );
  });

  it("encodes the id", () => {
    assert.equal(rescheduleRequestOtherTimePath("a/b"), "/api/reschedule/a%2Fb/request-other-time");
  });
});

describe("rescheduleOtherTimeErrorMessage", () => {
  it("explains that the option is not live yet while the endpoint does not exist", () => {
    for (const status of [404, 405, 501]) {
      assert.match(rescheduleOtherTimeErrorMessage(status, null), /not available yet/);
    }
  });

  it("asks for another time when the slot was just taken", () => {
    assert.match(rescheduleOtherTimeErrorMessage(409, "Slot already taken."), /just booked/);
  });

  it("says the link expired", () => {
    assert.match(rescheduleOtherTimeErrorMessage(410, null), /expired/);
  });

  it("shows the server message for other errors", () => {
    assert.equal(rescheduleOtherTimeErrorMessage(400, "Pick a time inside the booking window."), "Pick a time inside the booking window.");
  });

  it("falls back to a generic message", () => {
    assert.match(rescheduleOtherTimeErrorMessage(500, null), /Could not send/);
  });
});
