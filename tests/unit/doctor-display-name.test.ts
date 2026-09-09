import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  joinProfessionalFullName,
  splitProfessionalFullName,
} from "../../lib/doctor-display-name";

describe("splitProfessionalFullName", () => {
  it("splits a listing name into first and last", () => {
    assert.deepEqual(splitProfessionalFullName("Maria Papadopoulos"), {
      firstName: "Maria",
      lastName: "Papadopoulos",
    });
  });

  it("keeps extra last-name tokens together", () => {
    assert.deepEqual(splitProfessionalFullName("Dr. Andreas Costa Georgiou"), {
      firstName: "Andreas",
      lastName: "Costa Georgiou",
    });
  });

  it("returns an empty last name for a single token", () => {
    assert.deepEqual(splitProfessionalFullName("Madonna"), {
      firstName: "Madonna",
      lastName: "",
    });
  });
});

describe("joinProfessionalFullName", () => {
  it("joins first and last with a single space", () => {
    assert.equal(joinProfessionalFullName("Maria", "Papadopoulos"), "Maria Papadopoulos");
  });

  it("ignores blank parts", () => {
    assert.equal(joinProfessionalFullName("  Maria  ", "  "), "Maria");
  });
});
