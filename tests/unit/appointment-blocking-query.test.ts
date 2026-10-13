import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fetchBlockingAppointments } from "../../lib/appointment-blocking-query";

/**
 * One agenda per professional (Ro008, 2026-09-30): a visit in any clinic blocks that
 * time in all of her clinics, so the blocking query never filters by clinic.
 */
function recordingClient() {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  };
  return { client, calls };
}

describe("fetchBlockingAppointments", () => {
  it("reads the professional's blocking visits across every clinic", async () => {
    const { client, calls } = recordingClient();
    const res = await fetchBlockingAppointments(client as never, "pro-1");
    assert.deepEqual(res, { data: [], error: null });
    assert.deepEqual(calls.find((c) => c.method === "from")?.args, ["appointments"]);
    assert.ok(calls.some((c) => c.method === "eq" && c.args[0] === "professional_id" && c.args[1] === "pro-1"));
    assert.ok(!calls.some((c) => c.method === "eq" && /location_id|clinic_id/.test(String(c.args[0]))));
  });

  it("takes no clinic argument", () => {
    assert.equal(fetchBlockingAppointments.length, 2);
  });
});
