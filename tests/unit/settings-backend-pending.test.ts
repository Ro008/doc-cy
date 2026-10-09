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
      backendPendingMessage("removeClinic"),
      "Expected to fail for now: removing a clinic works once Livio builds it in the backend (DELETE /api/professional-clinics).",
    );
  });

  it("has a message for every stubbed settings action", () => {
    assert.deepEqual(Object.keys(BACKEND_PENDING).sort(), [
      "addClinic",
      "cancelSpecialtyRequest",
      "clinicChangeRequest",
      "removeClinic",
      "removeSpecialty",
      "requestSpecialty",
    ]);
    for (const action of Object.keys(BACKEND_PENDING) as (keyof typeof BACKEND_PENDING)[]) {
      const message = backendPendingMessage(action);
      assert.match(message, /^Expected to fail for now: /);
      assert.match(message, /Livio/);
      assert.match(message, new RegExp(BACKEND_PENDING[action].endpoint.replace(/[/?]/g, "\$&")));
    }
  });
});

describe("asking for a new specialty", () => {
  it("waits for Livio's new specialty requests (the old ones were dropped on master, E3)", () => {
    assert.equal(
      backendPendingMessage("requestSpecialty"),
      "Expected to fail for now: asking for a new specialty works once Livio builds it in the backend (POST /api/specialty-requests).",
    );
  });
});

describe("cancelling a specialty request", () => {
  it("waits for Livio's DELETE on the request endpoint", () => {
    assert.equal(
      backendPendingMessage("cancelSpecialtyRequest"),
      "Expected to fail for now: cancelling a specialty request works once Livio builds it in the backend (DELETE /api/specialty-requests).",
    );
  });
});

describe("settingsActionErrorMessage", () => {
  it("says the endpoint is not built yet when the route does not exist", () => {
    assert.equal(
      settingsActionErrorMessage("removeClinic", 404, {}, "Could not remove clinic."),
      backendPendingMessage("removeClinic"),
    );
    assert.equal(
      settingsActionErrorMessage("removeSpecialty", 405, {}, "Could not remove the specialty."),
      backendPendingMessage("removeSpecialty"),
    );
  });

  it("keeps the server's own message for a real refusal", () => {
    assert.equal(
      settingsActionErrorMessage("removeClinic", 400, { message: "Your profile needs at least one clinic." }, "x"),
      "Your profile needs at least one clinic.",
    );
  });

  it("falls back when the server sends no message", () => {
    assert.equal(settingsActionErrorMessage("removeClinic", 500, {}, "Could not remove clinic."), "Could not remove clinic.");
    assert.equal(settingsActionErrorMessage("removeClinic", 500, null, "Could not remove clinic."), "Could not remove clinic.");
  });
});
