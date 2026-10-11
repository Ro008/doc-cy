import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BACKEND_PENDING,
  backendPendingMessage,
  settingsActionErrorMessage,
} from "../../lib/settings-backend-pending";

describe("backendPendingMessage", () => {
  it("says the failure is expected and names what Livio has to build", () => {
    assert.equal(
      backendPendingMessage("addClinic"),
      "Expected to fail for now: asking for a new clinic works once Livio builds it in the backend (POST /api/clinic-requests).",
    );
  });

  it("has a message for every stubbed settings action", () => {
    assert.deepEqual(Object.keys(BACKEND_PENDING).sort(), [
      "addClinic",
      "clinicChangeRequest",
    ]);
    for (const action of Object.keys(BACKEND_PENDING) as (keyof typeof BACKEND_PENDING)[]) {
      const message = backendPendingMessage(action);
      assert.match(message, /^Expected to fail for now: /);
      assert.match(message, /Livio/);
      assert.match(message, new RegExp(BACKEND_PENDING[action].endpoint.replace(/[/?]/g, "\$&")));
    }
  });
});

describe("settingsActionErrorMessage", () => {
  it("says the endpoint is not built yet when the route does not exist", () => {
    assert.equal(
      settingsActionErrorMessage("clinicChangeRequest", 404, {}, "Could not remove clinic."),
      backendPendingMessage("clinicChangeRequest"),
    );
    assert.equal(
      settingsActionErrorMessage("addClinic", 405, {}, "Could not add the clinic."),
      backendPendingMessage("addClinic"),
    );
  });

  it("keeps the server's own message for a real refusal", () => {
    assert.equal(
      settingsActionErrorMessage("clinicChangeRequest", 400, { message: "Your profile needs at least one clinic." }, "x"),
      "Your profile needs at least one clinic.",
    );
  });

  it("falls back when the server sends no message", () => {
    assert.equal(settingsActionErrorMessage("clinicChangeRequest", 500, {}, "Could not remove clinic."), "Could not remove clinic.");
    assert.equal(settingsActionErrorMessage("clinicChangeRequest", 500, null, "Could not remove clinic."), "Could not remove clinic.");
  });
});
