import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LAST_CLINIC_MESSAGE,
  LAST_SPECIALTY_MESSAGE,
  canRemoveClinic,
  canRemoveSpecialty,
  clinicsAfterRemoval,
} from "../../lib/settings-removal-rules";

const clinic = (id: string, isPrimary = false) => ({ id, isPrimary });

describe("canRemoveClinic", () => {
  it("allows removing a clinic while another one stays", () => {
    assert.deepEqual(canRemoveClinic([clinic("a", true), clinic("b")], "b"), { ok: true });
  });

  it("allows removing the primary clinic when another one stays", () => {
    assert.deepEqual(canRemoveClinic([clinic("a", true), clinic("b")], "a"), { ok: true });
  });

  it("allows removing clinics down to one", () => {
    const three = [clinic("a", true), clinic("b"), clinic("c")];
    assert.deepEqual(canRemoveClinic(three, "c"), { ok: true });
    assert.deepEqual(canRemoveClinic(clinicsAfterRemoval(three, "c"), "b"), { ok: true });
  });

  it("keeps the last clinic", () => {
    assert.deepEqual(canRemoveClinic([clinic("a", true)], "a"), {
      ok: false,
      reason: "last",
      message: LAST_CLINIC_MESSAGE,
    });
  });

  it("refuses a clinic that is not on the profile", () => {
    const result = canRemoveClinic([clinic("a", true), clinic("b")], "zzz");
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "not-found");
  });

  it("says why in plain words", () => {
    assert.equal(LAST_CLINIC_MESSAGE, "Your profile needs at least one clinic.");
  });
});

describe("clinicsAfterRemoval", () => {
  it("drops the clinic and keeps the primary", () => {
    assert.deepEqual(clinicsAfterRemoval([clinic("a", true), clinic("b"), clinic("c")], "b"), [
      clinic("a", true),
      clinic("c"),
    ]);
  });

  it("promotes the next clinic when the primary one goes", () => {
    assert.deepEqual(clinicsAfterRemoval([clinic("a", true), clinic("b"), clinic("c")], "a"), [
      clinic("b", true),
      clinic("c"),
    ]);
  });

  it("keeps the other fields of each clinic", () => {
    const rows = [
      { id: "a", isPrimary: true, label: "Limassol" },
      { id: "b", isPrimary: false, label: "Paphos" },
    ];
    assert.deepEqual(clinicsAfterRemoval(rows, "a"), [
      { id: "b", isPrimary: true, label: "Paphos" },
    ]);
  });

  it("never removes the last clinic", () => {
    assert.deepEqual(clinicsAfterRemoval([clinic("a", true)], "a"), [clinic("a", true)]);
  });

  it("returns the same clinics for an unknown id", () => {
    const rows = [clinic("a", true), clinic("b")];
    assert.deepEqual(clinicsAfterRemoval(rows, "zzz"), rows);
  });
});

describe("canRemoveSpecialty", () => {
  it("allows removing a specialty while another one stays", () => {
    assert.deepEqual(canRemoveSpecialty(["Dermatology", "Venereology"], "Venereology"), {
      ok: true,
      specialty: "Venereology",
    });
  });

  it("matches the label regardless of case and spaces", () => {
    assert.deepEqual(canRemoveSpecialty(["Dermatology", "Venereology"], "  venereology "), {
      ok: true,
      specialty: "Venereology",
    });
  });

  it("keeps the last specialty", () => {
    assert.deepEqual(canRemoveSpecialty(["Dermatology"], "Dermatology"), {
      ok: false,
      reason: "last",
      message: LAST_SPECIALTY_MESSAGE,
    });
  });

  it("does not count blank labels as specialties", () => {
    const result = canRemoveSpecialty(["Dermatology", "  "], "Dermatology");
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "last");
  });

  it("refuses a specialty that is not on the profile", () => {
    const result = canRemoveSpecialty(["Dermatology", "Venereology"], "Cardiology");
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "not-found");
  });

  it("says why in plain words", () => {
    assert.equal(LAST_SPECIALTY_MESSAGE, "Your profile needs at least one specialty.");
  });
});
