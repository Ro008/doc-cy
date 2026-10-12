import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LAST_CLINIC_MESSAGE,
  LAST_SPECIALTY_MESSAGE,
  canRemoveClinic,
  canRemoveSpecialty,
  clinicsAfterRemoval,
} from "../../lib/settings-removal-rules";

const clinic = (id: string) => ({ id });

describe("canRemoveClinic", () => {
  it("allows removing a clinic while another one stays", () => {
    assert.deepEqual(canRemoveClinic([clinic("a"), clinic("b")], "b"), { ok: true });
  });

  it("allows removing the first clinic when another one stays", () => {
    assert.deepEqual(canRemoveClinic([clinic("a"), clinic("b")], "a"), { ok: true });
  });

  it("allows removing clinics down to one", () => {
    const three = [clinic("a"), clinic("b"), clinic("c")];
    assert.deepEqual(canRemoveClinic(three, "c"), { ok: true });
    assert.deepEqual(canRemoveClinic(clinicsAfterRemoval(three, "c"), "b"), { ok: true });
  });

  it("keeps the last clinic", () => {
    assert.deepEqual(canRemoveClinic([clinic("a")], "a"), {
      ok: false,
      reason: "last",
      message: LAST_CLINIC_MESSAGE,
    });
  });

  it("refuses a clinic that is not on the profile", () => {
    const result = canRemoveClinic([clinic("a"), clinic("b")], "zzz");
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "not-found");
  });

  it("says why in plain words", () => {
    assert.equal(
      LAST_CLINIC_MESSAGE,
      "You need at least one clinic. To change clinic, add the new one first, then leave this one.",
    );
  });
});

describe("clinicsAfterRemoval", () => {
  it("drops the clinic and keeps the others in order", () => {
    assert.deepEqual(clinicsAfterRemoval([clinic("a"), clinic("b"), clinic("c")], "b"), [
      clinic("a"),
      clinic("c"),
    ]);
  });

  it("leaves the others as they are when the first one goes (no primary clinic)", () => {
    assert.deepEqual(clinicsAfterRemoval([clinic("a"), clinic("b"), clinic("c")], "a"), [
      clinic("b"),
      clinic("c"),
    ]);
  });

  it("keeps the other fields of each clinic", () => {
    const rows = [
      { id: "a", label: "Limassol" },
      { id: "b", label: "Paphos" },
    ];
    assert.deepEqual(clinicsAfterRemoval(rows, "a"), [
      { id: "b", label: "Paphos" },
    ]);
  });

  it("never removes the last clinic", () => {
    assert.deepEqual(clinicsAfterRemoval([clinic("a")], "a"), [clinic("a")]);
  });

  it("returns the same clinics for an unknown id", () => {
    const rows = [clinic("a"), clinic("b")];
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
