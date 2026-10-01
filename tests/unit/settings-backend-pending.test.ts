import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BACKEND_PENDING_MESSAGE,
  settingsActionErrorMessage,
} from "../../lib/settings-backend-pending";

describe("settingsActionErrorMessage", () => {
  it("says the endpoint is not built yet when the route does not exist", () => {
    assert.equal(settingsActionErrorMessage(404, {}, "Could not remove clinic."), BACKEND_PENDING_MESSAGE);
    assert.equal(settingsActionErrorMessage(405, {}, "Could not remove clinic."), BACKEND_PENDING_MESSAGE);
  });

  it("names Livio's backend update in the temporary message", () => {
    assert.match(BACKEND_PENDING_MESSAGE, /expected/i);
    assert.match(BACKEND_PENDING_MESSAGE, /Livio/);
  });

  it("keeps the server's own message for a real refusal", () => {
    assert.equal(
      settingsActionErrorMessage(400, { message: "Your profile needs at least one clinic." }, "x"),
      "Your profile needs at least one clinic.",
    );
  });

  it("falls back when the server sends no message", () => {
    assert.equal(settingsActionErrorMessage(500, {}, "Could not remove clinic."), "Could not remove clinic.");
    assert.equal(settingsActionErrorMessage(500, null, "Could not remove clinic."), "Could not remove clinic.");
  });
});
