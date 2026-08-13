import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { parseFinderManualCalendarClick } from "@/lib/finder-manual-slot-click";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("parseFinderManualCalendarClick", () => {
  it("reads listing + slot from static calendar data attributes", () => {
    assert.deepEqual(
      parseFinderManualCalendarClick({
        manualId: "abc-123",
        doctorName: "Anna",
        mapsLink: "https://maps.example/anna",
        hasPhone: "1",
        address: "1 Ledra Street",
        slotKey: "2026-08-13-0",
      }),
      {
        manualId: "abc-123",
        doctorName: "Anna",
        addressMapsLink: "https://maps.example/anna",
        hasPhone: true,
        addressText: "1 Ledra Street",
        slotKey: "2026-08-13-0",
      },
    );
  });

  it("rejects clicks without a listing or slot", () => {
    assert.equal(
      parseFinderManualCalendarClick({
        manualId: "",
        doctorName: "Anna",
        mapsLink: "",
        hasPhone: "0",
        address: "",
        slotKey: "2026-08-13-0",
      }),
      null,
    );
    assert.equal(
      parseFinderManualCalendarClick({
        manualId: "abc",
        doctorName: "Anna",
        mapsLink: "",
        hasPhone: "0",
        address: "",
        slotKey: "",
      }),
      null,
    );
  });
});

describe("finder manual calendars stay static HTML", () => {
  it("does not hydrate a client island per manual calendar", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderManualCardAvailabilityGrid.tsx"),
      "utf8",
    );
    assert.equal(source.includes('"use client"'), false);
    assert.equal(source.includes("useManualBookingRequestFeedback"), false);
    assert.equal(source.includes("FINDER_MANUAL_CALENDAR_ATTR"), true);
    assert.equal(source.includes("FINDER_MANUAL_SLOT_ATTR"), true);
  });

  it("delegates slot clicks from the shared availability shell", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderResultsAvailabilityShell.tsx"),
      "utf8",
    );
    assert.equal(source.includes("useManualBookingRequestFeedback"), true);
    assert.equal(source.includes("FINDER_MANUAL_SLOT_ATTR"), true);
    assert.equal(source.includes("--finder-week-start"), true);
  });
});
