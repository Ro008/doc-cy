import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alreadyHasProfileSupportMessage,
  canClaimListing,
  registerPageGate,
} from "../../lib/register-gate";

/**
 * A professional who already has a profile can't register again or claim another
 * listing (bug, 2026-09-29): /register shows "You already have a DocCy profile"
 * instead of the form, and listing cards hide "Claim this Profile" for her.
 */

describe("registerPageGate", () => {
  it("shows the form to a signed-out visitor, a new login and a login re-applying", () => {
    assert.equal(registerPageGate(null), "form");
    assert.equal(registerPageGate({ kind: "new" }), "form");
    assert.equal(
      registerPageGate({ kind: "reapply", authUserId: "u1", email: "a@example.com" }),
      "form",
    );
  });

  it("sends a login with a pending application or draft to the Status page", () => {
    assert.equal(registerPageGate({ kind: "pending" }), "status");
  });

  it("tells a professional she already has a profile", () => {
    assert.equal(registerPageGate({ kind: "professional" }), "has_profile");
  });
});

describe("canClaimListing", () => {
  it("hides the claim prompt from a signed-in professional only", () => {
    assert.equal(canClaimListing("professional"), false);
    assert.equal(canClaimListing("applicant"), true);
    assert.equal(canClaimListing("none"), true);
    assert.equal(canClaimListing(null), true);
  });
});

describe("alreadyHasProfileSupportMessage", () => {
  it("names the listing she tried to claim", () => {
    const message = alreadyHasProfileSupportMessage("Anna Georgiou");
    assert.match(message, /Anna Georgiou/);
    assert.match(message, /already have a DocCy profile/i);
  });

  it("reads well without a listing", () => {
    const message = alreadyHasProfileSupportMessage(null);
    assert.doesNotMatch(message, /null|undefined/);
    assert.match(message, /already have a DocCy profile/i);
  });
});
