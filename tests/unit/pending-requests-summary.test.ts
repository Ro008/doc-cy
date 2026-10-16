import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { pendingRequestsSummary } from "../../lib/pending-requests-summary";

/**
 * The "Action required" banner on the Statistics tab says what is waiting (user,
 * 2026-10-15). It used to call everything a "registration request", also when the only
 * thing waiting was a patient's review.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const none = { registrations: 0, profileChanges: 0, clinicRequests: 0, reviews: 0 };

describe("pendingRequestsSummary", () => {
  it("names the one thing that is waiting", () => {
    assert.deepEqual(pendingRequestsSummary({ ...none, registrations: 1 }), {
      total: 1,
      headline: "1 registration request",
      breakdown: null,
    });
    assert.equal(pendingRequestsSummary({ ...none, registrations: 3 }).headline, "3 registration requests");
    assert.equal(pendingRequestsSummary({ ...none, reviews: 1 }).headline, "1 patient review");
    assert.equal(pendingRequestsSummary({ ...none, reviews: 2 }).headline, "2 patient reviews");
    assert.equal(pendingRequestsSummary({ ...none, profileChanges: 1 }).headline, "1 profile change request");
    assert.equal(pendingRequestsSummary({ ...none, profileChanges: 2 }).headline, "2 profile change requests");
    assert.equal(pendingRequestsSummary({ ...none, clinicRequests: 1 }).headline, "1 clinic request");
    assert.equal(pendingRequestsSummary({ ...none, clinicRequests: 4 }).headline, "4 clinic requests");
  });

  it("counts everything and lists what it is when there is more than one kind", () => {
    assert.deepEqual(pendingRequestsSummary({ registrations: 1, profileChanges: 0, clinicRequests: 0, reviews: 2 }), {
      total: 3,
      headline: "3 requests",
      breakdown: "1 registration request, 2 patient reviews",
    });
    assert.equal(
      pendingRequestsSummary({ registrations: 2, profileChanges: 1, clinicRequests: 1, reviews: 1 }).breakdown,
      "2 registration requests, 1 profile change request, 1 clinic request, 1 patient review",
    );
  });

  it("has nothing to say when nothing waits", () => {
    assert.deepEqual(pendingRequestsSummary(none), { total: 0, headline: "", breakdown: null });
  });
});

describe("the banner uses it", () => {
  const page = fs.readFileSync(path.join(repoRoot, "app/internal/directory/page.tsx"), "utf8");

  it("builds its title from the summary, not from a fixed 'registration request'", () => {
    assert.match(page, /pendingRequestsSummary\(/);
    assert.doesNotMatch(page, /registration request\$\{/);
  });
});
