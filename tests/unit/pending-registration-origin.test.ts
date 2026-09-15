import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPendingRegistrationOrigin,
  founderNotifySubjectForOrigin,
  isClaimedRegistrationOrigin,
  originFromClaimSource,
} from "../../lib/pending-registration-origin";

describe("pending registration origin", () => {
  it("maps card_link to Claimed", () => {
    const origin = originFromClaimSource("card_link");
    assert.equal(origin.kind, "claimed");
    assert.equal(origin.label, "Claimed");
    assert.equal(isClaimedRegistrationOrigin(origin.kind), true);
  });

  it("maps email / name match to Unclaimed", () => {
    assert.equal(originFromClaimSource("email").kind, "unclaimed");
    assert.equal(originFromClaimSource("name_specialty_district").kind, "unclaimed");
  });

  it("marks unclaimed when no claim source", () => {
    const origin = classifyPendingRegistrationOrigin({ claimSource: null });
    assert.equal(origin.kind, "unclaimed");
    assert.equal(origin.label, "Unclaimed");
  });

  it("does not twin-scan even when similar listings exist", () => {
    const origin = classifyPendingRegistrationOrigin({ claimSource: null });
    assert.equal(origin.kind, "unclaimed");
  });

  it("keeps claimed when card_link is stored", () => {
    const origin = classifyPendingRegistrationOrigin({ claimSource: "card_link" });
    assert.equal(origin.kind, "claimed");
  });

  it("builds distinct founder email subjects", () => {
    assert.equal(
      founderNotifySubjectForOrigin("claimed", "Ada"),
      "[DocCy] Finder listing claimed — Ada",
    );
    assert.equal(
      founderNotifySubjectForOrigin("unclaimed", "Ada"),
      "[DocCy] Unclaimed registration — Ada",
    );
  });
});
