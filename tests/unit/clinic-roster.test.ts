import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterClinicRosterBySpecialty,
  uniqueClinicRosterProfessionals,
} from "../../lib/clinic-roster";

const demetrios = {
  id: "d1",
  displayName: "Demetrios Hadjicosti",
  specialty: "Dentist",
  specialties: ["Oral Surgery", "Dentist"],
};
const panagiotis = {
  id: "d2",
  displayName: "Panagiotis Psara",
  specialty: "Dentist",
  specialties: ["Dentist"],
};

describe("clinic roster (unique + specialty filter)", () => {
  it("keeps one card per professional when the same person is listed twice", () => {
    const unique = uniqueClinicRosterProfessionals([demetrios, demetrios, panagiotis]);
    assert.deepEqual(
      unique.map((p) => p.id),
      ["d1", "d2"],
    );
  });

  it("filters by specialty without duplicating multi-specialty professionals", () => {
    const oral = filterClinicRosterBySpecialty([demetrios, panagiotis], "Oral Surgery");
    assert.deepEqual(
      oral.map((p) => p.id),
      ["d1"],
    );
    const dentists = filterClinicRosterBySpecialty(
      [demetrios, demetrios, panagiotis],
      "Dentist",
    );
    assert.deepEqual(
      dentists.map((p) => p.id),
      ["d1", "d2"],
    );
  });
});
