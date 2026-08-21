import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clinicRosterSpecialtyKeys,
  filterClinicRosterBySpecialty,
  splitClinicRosterByFinderVisibility,
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

  it("collapses Haematology and Hematology into one roster chip", () => {
    const niki = {
      id: "n1",
      displayName: "Niki Vyridou",
      specialty: "Haematology",
      specialties: ["Haematology", "Microbiology", "Hematology"],
    };
    assert.deepEqual(clinicRosterSpecialtyKeys(niki), [
      "Hematology",
      "Microbiology",
    ]);
    assert.deepEqual(
      filterClinicRosterBySpecialty([niki], "Haematology").map((p) => p.id),
      ["n1"],
    );
  });

  it("splits bookable vs inpatient-only for separate roster sections", () => {
    const inpatient = {
      id: "i1",
      displayName: "Inpatient Only",
      specialty: "Personal Doctor",
      specialties: ["Personal Doctor"],
      finderVisible: false as const,
    };
    const bookablePro = { ...panagiotis, finderVisible: true as const };
    const { bookable, inpatientOnly } = splitClinicRosterByFinderVisibility([
      bookablePro,
      inpatient,
      bookablePro,
    ]);
    assert.deepEqual(
      bookable.map((p) => p.id),
      ["d2"],
    );
    assert.deepEqual(
      inpatientOnly.map((p) => p.id),
      ["i1"],
    );
  });
});
