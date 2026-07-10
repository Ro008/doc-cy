import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveRegisterClinicLocation,
  shouldAllowRegisterClinicE2eFallback,
} from "../../lib/register-clinic-location";

describe("shouldAllowRegisterClinicE2eFallback", () => {
  it("allows test doctor emails outside production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousVercelEnv = process.env.VERCEL_ENV;
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;

    assert.equal(
      shouldAllowRegisterClinicE2eFallback("rociosirvent+qa@test-doccy.com.cy"),
      true,
    );

    process.env.NODE_ENV = previousNodeEnv;
    if (previousVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnv;
    }
  });

  it("blocks fallback on production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    assert.equal(
      shouldAllowRegisterClinicE2eFallback("rociosirvent+qa@test-doccy.com.cy"),
      false,
    );
    process.env.NODE_ENV = previousNodeEnv;
  });
});

describe("resolveRegisterClinicLocation", () => {
  it("accepts confirmed Google clinic coordinates", () => {
    const result = resolveRegisterClinicLocation({
      clinicAddress: "Clinic, Limassol, Cyprus",
      clinicLatitude: "34.7071",
      clinicLongitude: "33.0226",
      clinicPlaceId: "place-123",
      district: "Limassol",
      allowE2eFallback: false,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.district, "Limassol");
    assert.equal(result.value.clinicPlaceId, "place-123");
  });

  it("rejects free text without coordinates", () => {
    const result = resolveRegisterClinicLocation({
      clinicAddress: "Some typed clinic",
      clinicLatitude: "",
      clinicLongitude: "",
      clinicPlaceId: "",
      district: "",
      allowE2eFallback: false,
    });
    assert.deepEqual(result, { ok: false, code: "clinic_address" });
  });

  it("allows non-prod E2E fallback with district center coordinates", () => {
    const result = resolveRegisterClinicLocation({
      clinicAddress: "Test clinic Nicosia",
      clinicLatitude: "",
      clinicLongitude: "",
      clinicPlaceId: "",
      district: "Nicosia",
      allowE2eFallback: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.district, "Nicosia");
    assert.equal(result.value.latitude, 35.1856);
    assert.equal(result.value.longitude, 33.3823);
  });
});
