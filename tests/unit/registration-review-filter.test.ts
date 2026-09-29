import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reviewableRegistrationRows } from "../../lib/registration-review-filter";

/**
 * The Requests tab shows what founders can act on. Requests are permanent, so rows
 * that can never be decided (a pending request whose applicant login is gone) or
 * that only automated tests made are left out of the view, never deleted.
 */
const row = (overrides: Partial<Parameters<typeof reviewableRegistrationRows>[0][number]>) => ({
  status: "pending",
  applicant_auth_user_id: "u1",
  requester_email: "karina@example.org",
  ...overrides,
});

describe("reviewableRegistrationRows", () => {
  it("keeps pending requests whose applicant still has a login", () => {
    const { rows, hiddenPending } = reviewableRegistrationRows([row({}), row({ requester_email: "liviolanzo+t@gmail.com" })]);
    assert.equal(rows.length, 2);
    assert.equal(hiddenPending, 0);
  });

  it("hides pending requests whose login is gone, and counts them", () => {
    const { rows, hiddenPending } = reviewableRegistrationRows([
      row({ applicant_auth_user_id: null }),
      row({ applicant_auth_user_id: null, requester_email: "a@integration.test" }),
      row({}),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(hiddenPending, 2);
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
