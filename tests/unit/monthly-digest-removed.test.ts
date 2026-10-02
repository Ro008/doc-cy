import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// Point E1: no automatic emails to professionals for now; the monthly digest is gone.
const root = path.resolve(__dirname, "../..");

describe("monthly digest removed (Point E1)", () => {
  it("vercel.json schedules no monthly-digest cron and keeps the drafts purge", () => {
    const vercel = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };
    const paths = (vercel.crons ?? []).map((c) => c.path);
    assert.ok(!paths.some((p) => p.includes("monthly-digest")), `unexpected cron: ${paths.join(", ")}`);
    assert.ok(paths.includes("/api/cron/purge-registration-drafts"));
  });

  it("the digest route, job, email and preview script are deleted", () => {
    for (const file of [
      "app/api/cron/monthly-digest/route.ts",
      "lib/run-monthly-digest-job.ts",
      "lib/monthly-digest-metrics.ts",
      "lib/send-doctor-monthly-digest-email.ts",
      "scripts/send-monthly-digest-preview.mjs",
      "tests/integration/monthly_digest.integration.spec.ts",
    ]) {
      assert.ok(!existsSync(path.join(root, file)), `${file} should be deleted`);
    }
  });
});
