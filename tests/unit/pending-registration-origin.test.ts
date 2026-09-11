import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPendingRegistrationOrigin,
  founderNotifySubjectForOrigin,
  originFromClaimSource,
} from "../../lib/pending-registration-origin";

describe("pending registration origin", () => {
  it("maps card_link to Claimed listing", () => {
    const origin = originFromClaimSource("card_link");
    assert.equal(origin.kind, "claimed_listing");
    assert.equal(origin.label, "Claimed listing");
  });

  it("maps email / name match to Auto-matched listing", () => {
    assert.equal(originFromClaimSource("email").kind, "auto_matched_listing");
    assert.equal(
      originFromClaimSource("name_specialty_district").kind,
      "auto_matched_listing",
    );
  });

  it("marks unclaimed when no claim and no similar listing", () => {
    const origin = classifyPendingRegistrationOrigin({
      claimSource: null,
      doctor: {
        doctorId: "reg-1",
        name: "Maria Papadopoulos",
        specialty: "Dentistry",
        district: "Nicosia",
      },
      unregisteredListings: [
        {
          id: "man-1",
          name: "Completely Different Person",
          specialty: "Cardiology",
          district: "Paphos",
          slug: "completely-different",
        },
      ],
    });
    assert.equal(origin.kind, "unclaimed_review");
    assert.equal(origin.label, "Unclaimed — review");
    assert.equal(origin.twins.length, 0);
  });

  it("marks possible twin when a similar unregistered listing exists", () => {
    const origin = classifyPendingRegistrationOrigin({
      claimSource: null,
      doctor: {
        doctorId: "reg-1",
        name: "Maria Papadopoulos",
        specialty: "Dentistry",
        district: "Nicosia",
      },
      unregisteredListings: [
        {
          id: "man-1",
          name: "Maria Papadopoulos",
          specialty: "Dentistry",
          district: "Nicosia",
          slug: "maria-papadopoulos",
        },
      ],
    });
    assert.equal(origin.kind, "possible_twin");
    assert.equal(origin.twins.length, 1);
    assert.equal(origin.twins[0]?.id, "man-1");
  });

  it("does not twin-scan when signup already converted a listing", () => {
    const origin = classifyPendingRegistrationOrigin({
      claimSource: "card_link",
      doctor: {
        doctorId: "reg-1",
        name: "Maria Papadopoulos",
        specialty: "Dentistry",
        district: "Nicosia",
      },
      unregisteredListings: [
        {
          id: "man-1",
          name: "Maria Papadopoulos",
          specialty: "Dentistry",
          district: "Nicosia",
          slug: "maria-papadopoulos",
        },
      ],
    });
    assert.equal(origin.kind, "claimed_listing");
    assert.equal(origin.twins.length, 0);
  });

  it("builds distinct founder email subjects", () => {
    assert.equal(
      founderNotifySubjectForOrigin("claimed_listing", "Ada"),
      "[DocCy] Finder listing claimed — Ada",
    );
    assert.equal(
      founderNotifySubjectForOrigin("auto_matched_listing", "Ada"),
      "[DocCy] Auto-matched listing — Ada",
    );
    assert.equal(
      founderNotifySubjectForOrigin("possible_twin", "Ada"),
      "[DocCy] Possible twin — Ada",
    );
    assert.equal(
      founderNotifySubjectForOrigin("unclaimed_review", "Ada"),
      "[DocCy] Unclaimed registration — Ada",
    );
  });
});
