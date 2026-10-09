import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeProfessionalMobile } from "../../lib/professional-mobile";

describe("professional personal mobile (register + Settings → Profile)", () => {
  it("accepts a real mobile with its country code and stores + and digits", () => {
    assert.deepEqual(normalizeProfessionalMobile("+35799123456"), { ok: true, e164: "+35799123456" });
    assert.deepEqual(normalizeProfessionalMobile("  +357 99 123 456 "), { ok: true, e164: "+35799123456" });
    assert.deepEqual(normalizeProfessionalMobile("+34 667-000-000"), { ok: true, e164: "+34667000000" });
    assert.deepEqual(normalizeProfessionalMobile("+44 (7400) 123456"), { ok: true, e164: "+447400123456" });
  });

  it("refuses an empty value", () => {
    assert.deepEqual(normalizeProfessionalMobile(""), { ok: false, problem: "required" });
    assert.deepEqual(normalizeProfessionalMobile("   "), { ok: false, problem: "required" });
    assert.deepEqual(normalizeProfessionalMobile(null), { ok: false, problem: "required" });
    assert.deepEqual(normalizeProfessionalMobile(42), { ok: false, problem: "required" });
  });

  it("refuses a number that is not a real mobile for its country", () => {
    // A Cyprus landline.
    assert.deepEqual(normalizeProfessionalMobile("+35722123456"), { ok: false, problem: "invalid" });
    // Right length for Spain, wrong prefix.
    assert.deepEqual(normalizeProfessionalMobile("+34123456789"), { ok: false, problem: "invalid" });
    // Too short, or just a dial code.
    assert.deepEqual(normalizeProfessionalMobile("+3579912"), { ok: false, problem: "invalid" });
    assert.deepEqual(normalizeProfessionalMobile("+357"), { ok: false, problem: "invalid" });
  });

  it("needs the country code, written with +", () => {
    assert.deepEqual(normalizeProfessionalMobile("99123456"), { ok: false, problem: "invalid" });
    assert.deepEqual(normalizeProfessionalMobile("0035799123456"), { ok: false, problem: "invalid" });
  });

  it("refuses letters and other characters", () => {
    assert.deepEqual(normalizeProfessionalMobile("+357 99 12345a"), { ok: false, problem: "invalid" });
    assert.deepEqual(normalizeProfessionalMobile("+35799123456 ext 2"), { ok: false, problem: "invalid" });
  });
});
