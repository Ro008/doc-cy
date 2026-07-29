import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FINDER_TRAFFIC_MIN_ABSOLUTE,
  FINDER_TRAFFIC_MIN_BASELINE,
  FINDER_TRAFFIC_SPIKE_MULTIPLIER,
  buildFinderTrafficAlertEmail,
  computeBaselineAverage,
  isFinderTrafficPath,
  shouldSendFinderTrafficAlert,
} from "@/lib/finder-traffic-alert";

describe("finder traffic alert thresholds", () => {
  it("matches finder paths", () => {
    assert.equal(isFinderTrafficPath("/finder"), true);
    assert.equal(isFinderTrafficPath("/finder/paphos/dermatology"), true);
    assert.equal(isFinderTrafficPath("/finder/professional/maria-pap"), true);
    assert.equal(isFinderTrafficPath("/agenda"), false);
  });

  it("computes baseline average", () => {
    assert.equal(computeBaselineAverage([20, 40, 60]), 40);
    assert.equal(computeBaselineAverage([]), 0);
  });

  it("does not alert below absolute floor", () => {
    assert.equal(
      shouldSendFinderTrafficAlert({
        humanCount: 50,
        baselineHumanAvg: 200,
      }),
      false,
    );
  });

  it("alerts when above multiplier and absolute floor", () => {
    assert.equal(
      shouldSendFinderTrafficAlert({
        humanCount: 180,
        baselineHumanAvg: 50,
        multiplier: FINDER_TRAFFIC_SPIKE_MULTIPLIER,
        minAbsolute: FINDER_TRAFFIC_MIN_ABSOLUTE,
      }),
      true,
    );
  });

  it("uses higher floor when baseline is tiny", () => {
    assert.equal(
      shouldSendFinderTrafficAlert({
        humanCount: 150,
        baselineHumanAvg: 2,
        minBaseline: FINDER_TRAFFIC_MIN_BASELINE,
        minAbsolute: FINDER_TRAFFIC_MIN_ABSOLUTE,
      }),
      false,
    );
    assert.equal(
      shouldSendFinderTrafficAlert({
        humanCount: 220,
        baselineHumanAvg: 2,
        minBaseline: FINDER_TRAFFIC_MIN_BASELINE,
        minAbsolute: FINDER_TRAFFIC_MIN_ABSOLUTE,
      }),
      true,
    );
  });
});

describe("buildFinderTrafficAlertEmail", () => {
  it("includes key sections in plain text", () => {
    const now = new Date("2026-07-29T08:00:00.000Z");
    const email = buildFinderTrafficAlertEmail({
      windowStart: new Date(now.getTime() - 60 * 60 * 1000),
      windowEnd: now,
      humanCount: 340,
      botCount: 52,
      baselineHumanAvg: 81,
      baselineSampleDays: 7,
      multiplier: 4.2,
      topPages: [
        { path: "/finder", count: 120 },
        { path: "/finder/paphos/dermatology", count: 85 },
      ],
      topCountries: [
        { country: "CY", count: 180 },
        { country: "DE", count: 90 },
      ],
      sampleUserAgents: ["python-requests/2.31.0", "Mozilla/5.0 (Windows NT 10.0)"],
    });

    assert.match(email.subject, /Unusual Finder traffic/);
    assert.match(email.text, /Summary/);
    assert.match(email.text, /340/);
    assert.match(email.text, /private doctor account data is not involved/);
    assert.match(email.text, /Most visited pages/);
    assert.doesNotMatch(email.text, /RLS/);
  });
});
