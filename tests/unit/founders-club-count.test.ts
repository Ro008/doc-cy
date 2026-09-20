import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const foundersClub = fs.readFileSync(path.join(repoRoot, "lib/founders-club.ts"), "utf8");

/**
 * `spotsRemaining` is rendered on the public marketing page. It used to include a
 * hardcoded QA slug via a "marketing override", so a seeded test doctor moved a number
 * prospective customers read. Both guards below exist to stop that coming back.
 */
describe("founders club availability count", () => {
  it("excludes test profiles from the public count", () => {
    assert.equal(foundersClub.includes('.eq("is_test_profile", false)'), true);
  });

  it("has no slug-based marketing override", () => {
    assert.equal(foundersClub.includes("MARKETING_INCLUDED_DOCTOR_SLUGS"), false);
    assert.equal(foundersClub.includes("andreas-nikos"), false);
    // A slug filter here would mean someone reintroduced a hand-picked inclusion list.
    assert.equal(foundersClub.includes('.in("slug"'), false);
  });

  it("still fails safe rather than overselling when data is unavailable", () => {
    // On a missing client or a query error the count must report a full house, never
    // an empty one that advertises 50 free founder spots.
    const fallbacks = foundersClub.split("currentUsersCount: MAX_FOUNDERS").length - 1;
    assert.equal(fallbacks, 2);
    assert.equal(foundersClub.includes("offerAvailable: false"), true);
  });
});
