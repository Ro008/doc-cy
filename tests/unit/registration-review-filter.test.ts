import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reviewableRegistrationRows } from "../../lib/registration-review-filter";

/**
 * The Requests tab shows what founders can act on. Requests are permanent, so rows
 * are left out of the view, never deleted:
 * - a pending request whose applicant login is gone can never be approved; a real
 *   applicant's goes to the "Can't be approved" group (founders close it), one that
 *   automated tests made is only counted;
 * - decisions on automated-test addresses are not shown.
 */
const row = (overrides: Partial<Parameters<typeof reviewableRegistrationRows>[0][number]>) => ({
  status: "pending",
  applicant_auth_user_id: "u1",
  requester_email: "karina@example.org",
  ...overrides,
});

describe("reviewableRegistrationRows", () => {
  it("keeps pending requests whose applicant still has a login", () => {
    const { rows, unapprovable, hiddenPending } = reviewableRegistrationRows([
      row({}),
      row({ requester_email: "liviolanzo+t@gmail.com" }),
    ]);
    assert.equal(rows.length, 2);
    assert.equal(unapprovable.length, 0);
    assert.equal(hiddenPending, 0);
  });

  it("puts a real applicant's pending request with no login in the unapprovable group, not the list", () => {
    const orphan = row({ applicant_auth_user_id: null, requester_email: "liviolanzo+gone@gmail.com" });
    const { rows, unapprovable, hiddenPending } = reviewableRegistrationRows([orphan, row({})]);
    assert.equal(rows.length, 1);
    assert.deepEqual(unapprovable, [orphan]);
    assert.equal(hiddenPending, 0);
  });

  it("only counts pending requests with no login that automated tests made", () => {
    const { rows, unapprovable, hiddenPending } = reviewableRegistrationRows([
      row({ applicant_auth_user_id: null, requester_email: "a@integration.test" }),
      row({ applicant_auth_user_id: null, requester_email: "b@test-doccy.com.cy" }),
      row({}),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(unapprovable.length, 0);
    assert.equal(hiddenPending, 2);
  });

  it("never treats a decided request as unapprovable", () => {
    const { rows, unapprovable } = reviewableRegistrationRows([
      row({ status: "rejected", applicant_auth_user_id: null }),
      row({ status: "approved", applicant_auth_user_id: null }),
    ]);
    assert.equal(rows.length, 2);
    assert.equal(unapprovable.length, 0);
  });

  it("hides decisions on automated-test addresses, but not real test inboxes", () => {
    const { rows } = reviewableRegistrationRows([
      row({ status: "approved", requester_email: "a@integration.test" }),
      row({ status: "rejected", requester_email: "test-registration-e2e-avatar-1@test-doccy.com.cy" }),
      row({ status: "approved", requester_email: "liviolanzo+avgi@gmail.com", applicant_auth_user_id: null }),
    ]);
    assert.deepEqual(
      rows.map((r) => r.requester_email),
      ["liviolanzo+avgi@gmail.com"],
    );
  });
});
