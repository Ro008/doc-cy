import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { accountKind, applicantIdentity } from "../../lib/account-summary";

/**
 * What the top-right menu knows about a signed-in account: a professional (full
 * menu, their avatar), an applicant still waiting for the founders (Support and
 * Log out only, the photo they uploaded), or nothing at all (no profile, no
 * application: not kept signed in).
 */

const LOGIN = "4b8d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const photo = (name: string) => ({ bucket: "request-uploads", path: `professional_registration/${LOGIN}/${name}.jpg` });

describe("accountKind", () => {
  it("is a professional when the login has a profile", () => {
    assert.equal(accountKind({ hasProfessional: true, status: "none" }), "professional");
    assert.equal(accountKind({ hasProfessional: true, status: "pending" }), "professional");
  });

  it("is an applicant while anything is waiting or was decided without a profile", () => {
    for (const status of ["confirm_email", "pending", "denied", "withdrawn"] as const) {
      assert.equal(accountKind({ hasProfessional: false, status }), "applicant", status);
    }
  });

  it("is nothing without a profile or an application", () => {
    assert.equal(accountKind({ hasProfessional: false, status: "none" }), "none");
  });
});

describe("applicantIdentity", () => {
  it("uses the draft still waiting for the confirmation link first", () => {
    assert.deepEqual(
      applicantIdentity(LOGIN, {
        draft: { first_name: "Maria", last_name: "Merakli", photo: photo("draft") },
        latestRequest: { details: { first_name: "Old", last_name: "Name", photo: photo("old") }, approved_details: null },
      }),
      { name: "Maria Merakli", photoPath: photo("draft").path },
    );
  });

  it("then the latest request, preferring what founders approved", () => {
    assert.deepEqual(
      applicantIdentity(LOGIN, {
        draft: null,
        latestRequest: {
          details: { first_name: "Maria", last_name: "Merakli", photo: photo("sent") },
          approved_details: null,
        },
      }),
      { name: "Maria Merakli", photoPath: photo("sent").path },
    );
    assert.deepEqual(
      applicantIdentity(LOGIN, {
        draft: null,
        latestRequest: {
          details: { first_name: "Maria", last_name: "Merakli", photo: photo("sent") },
          // Founders replaced the photo and corrected the name.
          approved_details: { first_name: "Maria", last_name: "Merakli-Ioannou", photo: photo("replaced") },
        },
      }),
      { name: "Maria Merakli-Ioannou", photoPath: photo("replaced").path },
    );
  });

  it("shows no photo when founders removed it, or when it isn't this login's upload", () => {
    assert.equal(
      applicantIdentity(LOGIN, {
        draft: null,
        latestRequest: {
          details: { first_name: "A", last_name: "B", photo: photo("sent") },
          approved_details: { first_name: "A", last_name: "B", photo: null },
        },
      }).photoPath,
      null,
    );
    assert.equal(
      applicantIdentity(LOGIN, {
        draft: { first_name: "A", last_name: "B", photo: { bucket: "request-uploads", path: "professional_registration/someone-else/x.jpg" } },
        latestRequest: null,
      }).photoPath,
      null,
    );
  });

  it("has nothing to show without a draft or a request", () => {
    assert.deepEqual(applicantIdentity(LOGIN, { draft: null, latestRequest: null }), { name: null, photoPath: null });
  });
});
