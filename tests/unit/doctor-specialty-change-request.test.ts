import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSpecialtyChangeApproveReviewBody,
  parseSpecialtyChangeRequestKind,
  validateSpecialtyChangeAgainstProfile,
  validateSpecialtyChangeRequestInput,
} from "@/lib/doctor-specialty-change-request";

describe("validateSpecialtyChangeRequestInput", () => {
  it("requires license and a valid specialty", () => {
    assert.equal(
      validateSpecialtyChangeRequestInput({
        toSpecialty: "Pediatrics",
        toSpecialtyFromMaster: true,
        licenseNumber: "",
      }).ok,
      false,
    );
    assert.equal(
      validateSpecialtyChangeRequestInput({
        toSpecialty: "",
        toSpecialtyFromMaster: true,
        licenseNumber: "123",
      }).ok,
      false,
    );
  });

  it("accepts a master specialty with license", () => {
    const result = validateSpecialtyChangeRequestInput({
      toSpecialty: "Pediatrics",
      toSpecialtyFromMaster: true,
      licenseNumber: " 123456 ",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.toSpecialty, "Pediatrics");
      assert.equal(result.licenseNumber, "123456");
      assert.equal(result.isSpecialtyApproved, true);
    }
  });
});

describe("parseSpecialtyChangeRequestKind", () => {
  it("accepts add, replace, and remove", () => {
    assert.equal(parseSpecialtyChangeRequestKind("add"), "add");
    assert.equal(parseSpecialtyChangeRequestKind("REPLACE"), "replace");
    assert.equal(parseSpecialtyChangeRequestKind("remove"), "remove");
    assert.equal(parseSpecialtyChangeRequestKind("change"), null);
    assert.equal(parseSpecialtyChangeRequestKind(""), null);
  });
});

describe("validateSpecialtyChangeAgainstProfile", () => {
  const existing = ["Dentistry", "Psychology"];

  it("allows adding a new specialty", () => {
    const result = validateSpecialtyChangeAgainstProfile({
      kind: "add",
      toSpecialty: "Pediatrics",
      existingLabels: existing,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.fromSpecialty, null);
  });

  it("rejects adding a specialty already on the profile", () => {
    const result = validateSpecialtyChangeAgainstProfile({
      kind: "add",
      toSpecialty: "dentistry",
      existingLabels: existing,
    });
    assert.equal(result.ok, false);
  });

  it("allows replacing one existing specialty with a new one", () => {
    const result = validateSpecialtyChangeAgainstProfile({
      kind: "replace",
      fromSpecialty: "Dentistry",
      toSpecialty: "Pediatrics",
      existingLabels: existing,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.fromSpecialty, "Dentistry");
  });

  it("rejects replace without fromSpecialty or when target already exists", () => {
    assert.equal(
      validateSpecialtyChangeAgainstProfile({
        kind: "replace",
        fromSpecialty: "",
        toSpecialty: "Pediatrics",
        existingLabels: existing,
      }).ok,
      false,
    );
    assert.equal(
      validateSpecialtyChangeAgainstProfile({
        kind: "replace",
        fromSpecialty: "Dentistry",
        toSpecialty: "Psychology",
        existingLabels: existing,
      }).ok,
      false,
    );
    assert.equal(
      validateSpecialtyChangeAgainstProfile({
        kind: "replace",
        fromSpecialty: "Dentistry",
        toSpecialty: "Dentistry",
        existingLabels: existing,
      }).ok,
      false,
    );
  });

  it("allows removing one specialty when two or more exist", () => {
    const result = validateSpecialtyChangeAgainstProfile({
      kind: "remove",
      fromSpecialty: "Psychology",
      existingLabels: existing,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.fromSpecialty, "Psychology");
  });

  it("rejects remove when only one specialty remains", () => {
    assert.equal(
      validateSpecialtyChangeAgainstProfile({
        kind: "remove",
        fromSpecialty: "Dentistry",
        existingLabels: ["Dentistry"],
      }).ok,
      false,
    );
  });
});

describe("buildSpecialtyChangeApproveReviewBody", () => {
  it("approves remove without specialty or license", () => {
    const result = buildSpecialtyChangeApproveReviewBody({
      requestId: "req-1",
      requestKind: "remove",
      fromSpecialty: "Psychology",
      toSpecialty: "",
      licenseNumber: "",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.body, {
        requestId: "req-1",
        action: "approve",
      });
      assert.equal("toSpecialty" in result.body, false);
      assert.equal("licenseNumber" in result.body, false);
    }
  });

  it("rejects remove when fromSpecialty is missing", () => {
    const result = buildSpecialtyChangeApproveReviewBody({
      requestId: "req-1",
      requestKind: "remove",
      fromSpecialty: "  ",
      toSpecialty: "",
      licenseNumber: "",
    });
    assert.equal(result.ok, false);
  });

  it("requires specialty and license for add", () => {
    assert.equal(
      buildSpecialtyChangeApproveReviewBody({
        requestId: "req-2",
        requestKind: "add",
        fromSpecialty: "",
        toSpecialty: "",
        licenseNumber: "123",
      }).ok,
      false,
    );
    assert.equal(
      buildSpecialtyChangeApproveReviewBody({
        requestId: "req-2",
        requestKind: "add",
        fromSpecialty: "",
        toSpecialty: "Pediatrics",
        licenseNumber: "",
      }).ok,
      false,
    );
    const ok = buildSpecialtyChangeApproveReviewBody({
      requestId: "req-2",
      requestKind: "add",
      fromSpecialty: "",
      toSpecialty: "Pediatrics",
      licenseNumber: "LIC-9",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.body.toSpecialty, "Pediatrics");
      assert.equal(ok.body.licenseNumber, "LIC-9");
      assert.equal(ok.body.toSpecialtyFromMaster, true);
    }
  });
});
