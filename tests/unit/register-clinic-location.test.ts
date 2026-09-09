import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readRegisterClinicsFromFormData,
  registerClinicInputNames,
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
    assert.equal(result.value.town, "Limassol");
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
    assert.equal(result.value.town, "Nicosia");
    assert.equal(result.value.latitude, 35.1856);
    assert.equal(result.value.longitude, 33.3823);
  });
});

describe("registerClinicInputNames", () => {
  it("keeps the primary clinic on the original field names", () => {
    assert.deepEqual(registerClinicInputNames(0), {
      address: "clinicAddress",
      latitude: "clinicLatitude",
      longitude: "clinicLongitude",
      placeId: "clinicPlaceId",
      district: "district",
      town: "town",
      confirmed: "clinicConfirmed",
    });
  });

  it("namespaces extra clinics", () => {
    assert.equal(registerClinicInputNames(1).address, "clinic1Address");
    assert.equal(registerClinicInputNames(1).district, "clinic1District");
  });
});

describe("readRegisterClinicsFromFormData", () => {
  it("reads the primary clinic and stops at the first empty extra slot", () => {
    const formData = new FormData();
    formData.set("clinicAddress", "Clinic, Limassol, Cyprus");
    formData.set("clinicLatitude", "34.7071");
    formData.set("clinicLongitude", "33.0226");
    formData.set("clinicPlaceId", "place-123");
    formData.set("district", "Limassol");
    formData.set("town", "Limassol");

    const result = readRegisterClinicsFromFormData(formData, false, 5);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.length, 1);
    assert.equal(result.value[0]?.district, "Limassol");
  });
});
