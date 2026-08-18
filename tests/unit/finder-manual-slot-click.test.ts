import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { parseFinderManualRequestClick } from "@/lib/finder-manual-slot-click";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("parseFinderManualRequestClick", () => {
  it("reads the listing id from static calendar data attributes", () => {
    assert.deepEqual(parseFinderManualRequestClick({ manualId: "abc-123" }), {
      manualId: "abc-123",
    });
  });

  it("rejects clicks without a listing id", () => {
    assert.equal(parseFinderManualRequestClick({ manualId: "" }), null);
    assert.equal(parseFinderManualRequestClick({ manualId: "   " }), null);
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
    assert.equal(source.includes("buildManualPreviewCalendar"), true);
    assert.equal(source.includes("FINDER_MANUAL_CALENDAR_ATTR"), true);
    assert.equal(source.includes("FINDER_MANUAL_REQUEST_ATTR"), true);
    assert.equal(source.includes("FINDER_MANUAL_SLOT_ATTR"), false);
  });

  it("delegates request clicks from the shared availability shell", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderResultsAvailabilityShell.tsx"),
      "utf8",
    );
    assert.equal(source.includes("useManualBookingRequestFeedback"), true);
    assert.equal(source.includes("FINDER_MANUAL_REQUEST_ATTR"), true);
    assert.equal(source.includes("--finder-week-start"), true);
  });

  it("confirms the request with a toast instead of a modal", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "components/finder/useManualBookingRequestFeedback.tsx"),
      "utf8",
    );
    assert.equal(source.includes("ManualBookingRequestModal"), false);
    assert.equal(source.includes("toast.success"), true);
    assert.equal(source.includes("Thank you! We will notify the doctor."), true);
  });
});
