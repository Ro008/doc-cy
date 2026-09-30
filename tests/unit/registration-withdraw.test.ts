import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRegistrationWithdrawnNotifyContent,
  withdrawRegistrationRequest,
} from "../../lib/registration-withdraw";

/**
 * An applicant withdraws their own pending registration from the Status page.
 * The server finds the pending request of the signed-in login, closes it with
 * request_withdraw_as_applicant, and tells the founders it left the queue.
 */

type Call = { fn: string; args: Record<string, unknown> };

function fakeService(options: {
  pending?: { id: string; requester_name: string | null; requester_email: string | null; details: unknown } | null;
  lookupError?: { message: string } | null;
  rpcError?: { code: string; message: string } | null;
}) {
  const calls: Call[] = [];
  const filters: Record<string, unknown> = {};
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return query;
    },
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: options.pending ?? null, error: options.lookupError ?? null }),
  };
  const service = {
    from: (table: string) => {
      calls.push({ fn: `from:${table}`, args: {} });
      return query;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: null, error: options.rpcError ?? null };
    },
  };
  return { service: service as never, calls, filters };
}

const pending = {
  id: "req-1",
  requester_name: "Karina Miño",
  requester_email: "karina@example.org",
  details: { founders_club: true },
};

describe("withdrawRegistrationRequest", () => {
  it("closes the signed-in applicant's pending registration", async () => {
    const notified: string[] = [];
    const { service, calls, filters } = fakeService({ pending });
    const result = await withdrawRegistrationRequest(service, "login-1", {
      notify: async (request) => {
        notified.push(request.id);
      },
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(filters.applicant_auth_user_id, "login-1");
    assert.equal(filters.status, "pending");
    assert.equal(filters.request_type, "professional_registration");
    const rpc = calls.find((c) => c.fn === "request_withdraw_as_applicant");
    assert.deepEqual(rpc?.args, { p_request_id: "req-1", p_auth_user_id: "login-1" });
    assert.deepEqual(notified, ["req-1"]);
  });

  it("refuses without a signed-in login", async () => {
    const { service, calls } = fakeService({ pending });
    const result = await withdrawRegistrationRequest(service, "", { notify: async () => {} });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 401);
    assert.equal(calls.length, 0);
  });

  it("answers 409 when there is no pending application to withdraw", async () => {
    const { service, calls } = fakeService({ pending: null });
    const result = await withdrawRegistrationRequest(service, "login-1", { notify: async () => {} });
    assert.equal(result.ok === false && result.status, 409);
    assert.ok(!calls.some((c) => c.fn === "request_withdraw_as_applicant"));
  });

  it("answers 409 when a founder decided it in the meantime", async () => {
    let notified = false;
    const { service } = fakeService({
      pending,
      rpcError: { code: "55000", message: "request req-1 is already approved" },
    });
    const result = await withdrawRegistrationRequest(service, "login-1", {
      notify: async () => {
        notified = true;
      },
    });
    assert.equal(result.ok === false && result.status, 409);
    assert.equal(notified, false);
  });

  it("answers 500 when the lookup fails", async () => {
    const { service } = fakeService({ lookupError: { message: "boom" } });
    const result = await withdrawRegistrationRequest(service, "login-1", { notify: async () => {} });
    assert.equal(result.ok === false && result.status, 500);
  });

  it("still succeeds when the founders' email fails", async () => {
    const { service } = fakeService({ pending });
    const result = await withdrawRegistrationRequest(service, "login-1", {
      notify: async () => {
        throw new Error("resend down");
      },
    });
    assert.deepEqual(result, { ok: true });
  });
});

describe("buildRegistrationWithdrawnNotifyContent", () => {
  it("names the applicant and says the place is released", () => {
    const { subject, text } = buildRegistrationWithdrawnNotifyContent({
      requestId: "req-1",
      name: "Karina Miño",
      email: "karina@example.org",
      foundersClub: true,
      siteUrl: "https://www.mydoccy.com/",
    });
    assert.equal(subject, "[WITHDRAWN] Registration request: Karina Miño");
    for (const line of [
      "Karina Miño withdrew their registration request. Nothing to review.",
      "Email: karina@example.org",
      "Founders' Club place: released",
      "Request id: req-1",
      "Requests: https://www.mydoccy.com/internal/directory?tab=requests",
    ]) {
      assert.ok(text.includes(line), `missing line: ${line}\n---\n${text}`);
    }
  });

  it("says when no place was held", () => {
    const { text } = buildRegistrationWithdrawnNotifyContent({
      requestId: "req-2",
      name: "Someone",
      email: "s@example.org",
      foundersClub: false,
      siteUrl: "https://www.mydoccy.com",
    });
    assert.ok(text.includes("Founders' Club place: none held"));
  });
});
