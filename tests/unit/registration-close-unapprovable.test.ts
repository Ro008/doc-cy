import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  approveRegistrationRequest,
  denyRegistrationRequest,
} from "../../lib/registration-requests";
import { describeUnapprovableRequests } from "../../lib/registration-unapprovable";

/**
 * A pending registration whose applicant login is gone can never be approved. Founders
 * close it from the "Can't be approved" group in the Requests tab: it is recorded as
 * rejected with a note (request_reject), the Founders' Club place is released, nothing
 * is deleted, and no email is sent (the "apply again" link would lead nowhere).
 */

type Call = { fn: string; args: Record<string, unknown> };

const details = {
  first_name: "Karina",
  last_name: "Test",
  gender: "female",
  gesy: true,
  email: "karina@example.org",
  mobile: "99123456",
  languages: ["English"],
  photo: null,
  specialties: [{ name: "Cardiology", from_catalogue: true, license_number: "123" }],
  clinics: [],
};

function fakeService(row: { status?: string; applicant_auth_user_id: string | null }) {
  const calls: Call[] = [];
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({
      data: {
        id: "req-1",
        request_type: "professional_registration",
        status: row.status ?? "pending",
        details,
        applicant_auth_user_id: row.applicant_auth_user_id,
      },
      error: null,
    }),
  };
  const service = {
    from: () => query,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: null, error: null };
    },
  };
  return { service: service as never, calls };
}

const sentTo = () => {
  const sent: string[] = [];
  return { sent, sendEmail: async (to: string) => void sent.push(to) };
};

describe("denyRegistrationRequest: closing a request whose login is gone", () => {
  it("rejects it through request_reject with the note, and sends no email", async () => {
    const { service, calls } = fakeService({ applicant_auth_user_id: null });
    const { sent, sendEmail } = sentTo();
    const result = await denyRegistrationRequest(service, {
      requestId: "req-1",
      adminId: "admin-1",
      reason: "Applicant's account was deleted",
      sendEmail,
    });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(calls, [
      {
        fn: "request_reject",
        args: { p_request_id: "req-1", p_admin_id: "admin-1", p_note: "Applicant's account was deleted" },
      },
    ]);
    assert.deepEqual(sent, []);
  });

  it("still needs a reason", async () => {
    const { service, calls } = fakeService({ applicant_auth_user_id: null });
    const result = await denyRegistrationRequest(service, { requestId: "req-1", adminId: "admin-1", reason: "   " });
    assert.equal(result.ok, false);
    assert.equal(calls.length, 0);
  });

  it("still emails the applicant when the login exists (a normal denial)", async () => {
    const { service, calls } = fakeService({ applicant_auth_user_id: "login-1" });
    const { sent, sendEmail } = sentTo();
    const result = await denyRegistrationRequest(service, {
      requestId: "req-1",
      adminId: "admin-1",
      reason: "Licence number does not match",
      sendEmail,
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(calls[0]?.fn, "request_reject");
    assert.deepEqual(sent, ["karina@example.org"]);
  });

  it("does not touch a request that is already decided", async () => {
    const { service, calls } = fakeService({ status: "rejected", applicant_auth_user_id: null });
    const result = await denyRegistrationRequest(service, { requestId: "req-1", adminId: "admin-1", reason: "x" });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 409);
    assert.equal(calls.length, 0);
  });
});

describe("approveRegistrationRequest: the login is still required", () => {
  it("refuses a request whose login is gone and never calls request_approve", async () => {
    const { service, calls } = fakeService({ applicant_auth_user_id: null });
    const result = await approveRegistrationRequest(service, {
      requestId: "req-1",
      adminId: "admin-1",
      details,
    });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 409);
    assert.equal(calls.length, 0);
  });
});

describe("describeUnapprovableRequests: what the collapsed group tells founders", () => {
  const text = (count: number) => describeUnapprovableRequests(count).join(" ");

  it("names the group and counts the requests", () => {
    const one = describeUnapprovableRequests(1);
    assert.match(one[0], /1 request\b/);
    assert.match(describeUnapprovableRequests(3)[0], /3 requests\b/);
  });

  it("says what these requests are: the applicant's login is gone, so they can never be approved", () => {
    assert.match(text(2), /login (no longer exists|was deleted)/i);
    assert.match(text(2), /can(no|')t be approved|never be approved/i);
  });

  it("says why they are worth closing: a Founders' Club place may still be held", () => {
    assert.match(text(2), /Founders' Club place/);
  });

  it("says what Close does: recorded as denied with a note, kept in the log, no email", () => {
    assert.match(text(2), /recorded as denied/i);
    assert.match(text(2), /not deleted|stays in the log/i);
    assert.match(text(2), /no email/i);
  });

  it("uses a plain word for one request and for several", () => {
    assert.match(text(1), /\bthis request\b/i);
    assert.match(text(4), /\bthese requests\b/i);
  });
});
