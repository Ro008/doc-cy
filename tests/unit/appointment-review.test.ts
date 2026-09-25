import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  QUICK_DURATIONS,
  buildReviewDayTimeline,
  reviewBackTarget,
  reviewPathFromDashboard,
  reviewTimeRangeLabel,
  wantsSuggestOnOpen,
} from "../../lib/appointment-review";

describe("reviewTimeRangeLabel", () => {
  it("shows the Cyprus start and end for the chosen length", () => {
    // 09:00Z is 12:00 in Cyprus (UTC+3 in September).
    assert.equal(reviewTimeRangeLabel("2026-09-28T09:00:00Z", 30), "12:00–12:30");
    assert.equal(reviewTimeRangeLabel("2026-09-28T09:00:00Z", 90), "12:00–13:30");
  });
});

describe("reviewBackTarget", () => {
  it("returns to the dashboard when the doctor came from it", () => {
    assert.deepEqual(reviewBackTarget("dashboard"), { href: "/dashboard", label: "Back to dashboard" });
  });

  it("returns to the agenda otherwise (email links, agenda)", () => {
    assert.deepEqual(reviewBackTarget(undefined), { href: "/agenda", label: "Back to agenda" });
    assert.deepEqual(reviewBackTarget("agenda"), { href: "/agenda", label: "Back to agenda" });
    assert.deepEqual(reviewBackTarget("https://evil.example"), { href: "/agenda", label: "Back to agenda" });
  });
});

describe("reviewPathFromDashboard / wantsSuggestOnOpen", () => {
  it("opens the review page ready to suggest other times", () => {
    assert.equal(
      reviewPathFromDashboard("abc", "suggest"),
      "/dashboard/appointments/abc?intent=suggest&from=dashboard",
    );
    assert.equal(reviewPathFromDashboard("a b"), "/dashboard/appointments/a%20b?from=dashboard");
  });

  it("only the suggest intent opens the suggestions", () => {
    assert.equal(wantsSuggestOnOpen("suggest"), true);
    assert.equal(wantsSuggestOnOpen(undefined), false);
    assert.equal(wantsSuggestOnOpen("decline"), false);
  });
});

describe("QUICK_DURATIONS", () => {
  it("offers the common lengths up front", () => {
    assert.deepEqual([...QUICK_DURATIONS], [15, 30, 45, 60]);
  });
});

describe("buildReviewDayTimeline", () => {
  const request = { id: "req", startIso: "2026-09-28T09:00:00Z", durationMinutes: 30, patientName: "Georgios M." };
  const other = (id: string, startIso: string, patient_name: string, status = "CONFIRMED", duration_minutes = 30) => ({
    id,
    appointment_datetime: startIso,
    patient_name,
    status,
    duration_minutes,
  });

  it("puts the request among the day's visits in time order", () => {
    const entries = buildReviewDayTimeline(
      [
        other("late", "2026-09-28T12:00:00Z", "Late"), // 15:00
        other("early", "2026-09-28T06:00:00Z", "Early"), // 09:00
      ],
      request,
    );
    assert.deepEqual(
      entries.map((e) => [e.id, e.rangeLabel, e.isRequest]),
      [
        ["early", "09:00–09:30", false],
        ["req", "12:00–12:30", true],
        ["late", "15:00–15:30", false],
      ],
    );
  });

  it("flags visits that overlap the request at the chosen length", () => {
    const rows = [other("clash", "2026-09-28T09:15:00Z", "Clash"), other("after", "2026-09-28T09:30:00Z", "After")];
    const at30 = buildReviewDayTimeline(rows, request);
    assert.deepEqual(at30.map((e) => [e.id, e.overlaps]), [
      ["req", true],
      ["clash", true],
      ["after", false],
    ]);
    const at15 = buildReviewDayTimeline(rows, { ...request, durationMinutes: 15 });
    assert.equal(at15.find((e) => e.id === "req")!.overlaps, false);
  });

  it("leaves out cancelled visits and the request's own row", () => {
    const entries = buildReviewDayTimeline(
      [
        other("req", request.startIso, "Georgios M.", "REQUESTED"),
        other("gone", "2026-09-28T07:00:00Z", "Gone", "CANCELLED"),
        other("pending", "2026-09-28T07:00:00Z", "Pending", "REQUESTED"),
      ],
      request,
    );
    assert.deepEqual(entries.map((e) => [e.id, e.status]), [
      ["pending", "requested"],
      ["req", "request"],
    ]);
  });
});
