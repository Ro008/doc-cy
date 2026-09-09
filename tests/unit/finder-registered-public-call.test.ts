import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("finder registered public Call", () => {
  it("batches opted-in Call flags by id without loading phone digits into finder SSR", () => {
    const loader = fs.readFileSync(
      path.join(repoRoot, "lib/public/load-finder-registered-public-call.ts"),
      "utf8",
    );
    const registered = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderRegisteredCardAvailability.tsx"),
      "utf8",
    );
    const page = fs.readFileSync(
      path.join(repoRoot, "app/finder/[[...filters]]/page.tsx"),
      "utf8",
    );
    const manualGrid = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderManualCardAvailabilityGrid.tsx"),
      "utf8",
    );
    const locationBlock = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderClinicLocationBlock.tsx"),
      "utf8",
    );

    assert.equal(loader.includes("fetchAllSupabaseRowsForIdChunks"), true);
    assert.equal(loader.includes('.select("id, phone, mobile_number, doctor_settings'), true);
    assert.equal(loader.includes('.select("id, phone")'), false);
    assert.equal(loader.includes("doctors_public"), false);
    assert.equal(loader.includes("ids.join("), false);

    assert.equal(registered.includes('kind="registered"'), true);
    assert.equal(registered.includes('variant="show-phone-number"'), true);
    assert.equal(registered.includes('variant="profile-call"'), false);
    assert.equal(registered.includes('variant="call-to-book"'), false);
    assert.equal(registered.includes("loadFinderRegisteredPublicCallIds"), true);
    assert.equal(registered.includes("tel:"), false);

    const selectAttemptsStart = page.indexOf("const registeredSelectAttempts");
    const selectAttemptsEnd = page.indexOf(
      "for (const selectClause of registeredSelectAttempts)",
    );
    assert.equal(selectAttemptsStart >= 0, true);
    assert.equal(selectAttemptsEnd > selectAttemptsStart, true);
    const selectAttempts = page.slice(selectAttemptsStart, selectAttemptsEnd);
    assert.equal(selectAttempts.includes("phone"), false);
    assert.equal(page.includes("FinderRegisteredPublicCall"), true);

    assert.equal(manualGrid.includes('kind="registered"'), false);
    assert.equal(locationBlock.includes('kind="registered"'), false);
    assert.equal(locationBlock.includes('kind="manual"'), true);
    assert.equal(locationBlock.includes('kind="clinic"'), true);
  });
});
