import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRequestedServiceId, requestedServiceRefusal } from "../../lib/requested-service";

/**
 * The service a patient may pick when requesting (user, 2026-10-04): optional, one of the
 * professional's own `professional_services`.
 */
describe("parseRequestedServiceId", () => {
  it("treats a missing or empty value as no service", () => {
    for (const value of [undefined, null, "", "   "]) {
      assert.deepEqual(parseRequestedServiceId(value), { ok: true, value: null });
    }
  });

  it("keeps a uuid, trimmed and lowercased", () => {
    assert.deepEqual(parseRequestedServiceId(" 3F2B8C1E-0D4A-4B7E-9C11-2A6F5E8D9B01 "), {
      ok: true,
      value: "3f2b8c1e-0d4a-4b7e-9c11-2a6f5e8d9b01",
    });
  });

  it("refuses anything else", () => {
    for (const value of ["abc", 42, { id: "x" }, "3f2b8c1e-0d4a-4b7e-9c11-2a6f5e8d9b0"]) {
      const out = parseRequestedServiceId(value);
      assert.equal(out.ok, false);
      assert.match(out.message!, /service/i);
    }
  });
});

describe("requestedServiceRefusal", () => {
  const pro = "11111111-1111-1111-1111-111111111111";

  it("accepts her own service", () => {
    assert.equal(requestedServiceRefusal({ id: "s", professional_id: pro, name: "Check-up" }, pro), null);
  });

  it("refuses a missing service or another professional's", () => {
    assert.match(requestedServiceRefusal(null, pro)!, /isn't offered/);
    assert.match(
      requestedServiceRefusal({ id: "s", professional_id: "22222222-2222-2222-2222-222222222222", name: "X" }, pro)!,
      /isn't offered/,
    );
  });
});
