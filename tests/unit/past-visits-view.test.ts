import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { groupVisitsByMonth, patientInitials, visitDateParts } from "../../lib/past-visits-view";

/**
 * The Visits tab's cards (user, 2026-10-12): a date tile, the patient's initials, and the
 * visits grouped under month headings. All in Cyprus time.
 */
describe("visitDateParts", () => {
  it("splits a visit into the pieces of the date tile, in Cyprus time", () => {
    // 21:30Z on 11 Oct is already 12 Oct 00:30 in Cyprus (UTC+3).
    assert.deepEqual(visitDateParts("2026-10-11T21:30:00Z"), {
      day: "12",
      month: "OCT",
      weekday: "Mon",
      time: "00:30",
    });
  });

  it("doesn't pad the day", () => {
    assert.equal(visitDateParts("2026-03-04T09:00:00Z").day, "4");
  });
});

describe("patientInitials", () => {
  it("takes the first letters of the first and last word", () => {
    assert.equal(patientInitials("marylin pat2"), "MP");
    assert.equal(patientInitials("Dimas Fernandez Ruiz"), "DR");
  });

  it("handles one word, extra spaces and nothing", () => {
    assert.equal(patientInitials("  Maria "), "M");
    assert.equal(patientInitials("[manual test] Same slot"), "MS");
    assert.equal(patientInitials(""), "?");
    assert.equal(patientInitials(null), "?");
  });
});

describe("groupVisitsByMonth", () => {
  const v = (id: string, iso: string) => ({ id, appointment_datetime: iso });

  it("groups consecutive visits under their month, keeping the order", () => {
    const groups = groupVisitsByMonth([
      v("a", "2026-10-12T09:00:00Z"),
      v("b", "2026-10-08T09:00:00Z"),
      v("c", "2026-09-30T09:00:00Z"),
      v("d", "2026-01-02T09:00:00Z"),
    ]);
    assert.deepEqual(
      groups.map((g) => [g.key, g.label, g.visits.map((x) => x.id)]),
      [
        ["2026-10", "October 2026", ["a", "b"]],
        ["2026-09", "September 2026", ["c"]],
        ["2026-01", "January 2026", ["d"]],
      ],
    );
  });

  it("uses Cyprus time for the month boundary", () => {
    // 30 Sep 22:00Z is 1 Oct 01:00 in Cyprus.
    assert.equal(groupVisitsByMonth([v("a", "2026-09-30T22:00:00Z")])[0]!.key, "2026-10");
  });

  it("is empty for no visits", () => {
    assert.deepEqual(groupVisitsByMonth([]), []);
  });
});
