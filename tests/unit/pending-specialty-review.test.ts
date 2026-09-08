import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPendingSpecialtyItems,
  type PendingSpecialtyJunctionRow,
  type PendingSpecialtyProfessional,
} from "@/lib/pending-specialty-review";

const karina: PendingSpecialtyProfessional = {
  id: "pro-1",
  name: "Karina Miño",
  email: "karina@example.com",
  specialty: "Psychology",
};

function junction(
  overrides: Partial<PendingSpecialtyJunctionRow> & { id: string },
): PendingSpecialtyJunctionRow {
  return {
    doctor_id: "pro-1",
    specialty: null,
    license_number: null,
    is_approved: true,
    ...overrides,
  };
}

describe("buildPendingSpecialtyItems", () => {
  it("reviews the custom specialty, not the approved primary", () => {
    const items = buildPendingSpecialtyItems(
      [karina],
      [
        junction({
          id: "spec-psy",
          specialty: "Psychology",
          license_number: "Bachelor's Degree in Psychology",
          is_approved: true,
        }),
        junction({
          id: "spec-sex",
          specialty: "Sexologist",
          license_number: "Clinical sexology training",
          is_approved: false,
        }),
      ],
    );

    assert.deepEqual(items, [
      {
        id: "pro-1",
        specialtyId: "spec-sex",
        name: "Karina Miño",
        email: "karina@example.com",
        specialty: "Sexologist",
        licenseNumber: "Clinical sexology training",
        approvedSpecialties: ["Psychology"],
        hasOtherSpecialties: true,
      },
    ]);
  });

  it("emits one item per pending specialty", () => {
    const items = buildPendingSpecialtyItems(
      [karina],
      [
        junction({ id: "a", specialty: "Sexologist", is_approved: false }),
        junction({ id: "b", specialty: "Sleep coaching", is_approved: false }),
      ],
    );

    assert.deepEqual(
      items.map((i) => i.specialty),
      ["Sexologist", "Sleep coaching"],
    );
    assert.equal(
      items.every((i) => i.approvedSpecialties.length === 0),
      true,
    );
    assert.equal(
      items.every((i) => i.hasOtherSpecialties),
      true,
    );
  });

  it("flags a lone pending specialty so rejecting closes the application", () => {
    const items = buildPendingSpecialtyItems(
      [{ ...karina, specialty: "meditation" }],
      [junction({ id: "only", specialty: "meditation", is_approved: false })],
    );

    assert.equal(items[0]?.hasOtherSpecialties, false);
    assert.equal(items[0]?.specialtyId, "only");
  });

  it("falls back to the denormalized column when there is no junction row", () => {
    const items = buildPendingSpecialtyItems([karina], []);

    assert.equal(items[0]?.specialtyId, null);
    assert.equal(items[0]?.specialty, "Psychology");
    assert.equal(items[0]?.hasOtherSpecialties, false);
  });

  it("keeps professionals apart when several have pending specialties", () => {
    const other: PendingSpecialtyProfessional = {
      id: "pro-2",
      name: "  ",
      email: null,
      specialty: "Wellness",
    };
    const items = buildPendingSpecialtyItems(
      [karina, other],
      [
        junction({ id: "a", specialty: "Sexologist", is_approved: false }),
        junction({
          id: "b",
          doctor_id: "pro-2",
          specialty: "energy healing",
          is_approved: false,
        }),
      ],
    );

    assert.deepEqual(
      items.map((i) => [i.id, i.specialty]),
      [
        ["pro-1", "Sexologist"],
        ["pro-2", "energy healing"],
      ],
    );
    assert.equal(items[1]?.name, "—");
  });
});
