import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");
const exists = (file: string) => fs.existsSync(path.join(repoRoot, file));

/**
 * Every public phone is the clinic's phone (user, 2026-09-29). The scraped
 * professionals.phone is never shown, and settings no longer write it.
 */
describe("public phone comes from the clinic", () => {
  it("the reveal API reads only clinics.phone", () => {
    const route = read("app/api/directory/contact-reveal/route.ts");
    assert.equal(route.includes('from("professionals")\n    .select("phone")'), false);
    assert.equal(/kind === "manual"/.test(route), false);
    assert.equal(/kind === "registered"/.test(route), false);
    assert.equal(route.includes("mobile_number"), false);
    assert.equal(route.includes('from("clinics")'), true);
  });

  it("the per-professional Call rules are gone", () => {
    assert.equal(exists("lib/public-call-phone.ts"), false);
    assert.equal(exists("lib/booking-contact-phone.ts"), false);
    assert.equal(exists("lib/public/load-finder-registered-public-call.ts"), false);
    assert.equal(exists("app/api/doctor-settings/public-phone/route.ts"), false);
  });

  it("public pages reveal clinic phones only", () => {
    for (const file of [
      "components/finder/FinderClinicLocationBlock.tsx",
      "components/finder/FinderRegisteredCardAvailability.tsx",
      "lib/public/doctor-profile-page.tsx",
    ]) {
      const source = read(file);
      assert.equal(source.includes('kind="manual"'), false, file);
      assert.equal(source.includes('kind="registered"'), false, file);
    }
    assert.equal(read("components/finder/FinderClinicLocationBlock.tsx").includes("listingHasPhone"), false);
  });

  it("settings never write professionals.phone and show clinic phones read-only", () => {
    const route = read("app/api/doctor-settings/route.ts");
    assert.equal(/\.phone = /.test(route), false);
    assert.equal(route.includes("directoryPhone"), false);
    assert.equal(route.includes("show_phone_public"), false);
    const page = read("app/agenda/settings/page.tsx");
    assert.equal(page.includes("loadSettingsClinicPhones"), true);
    assert.equal(page.includes("doctor.mobile_number ?? doctor.phone"), false);
    const phones = read("components/dashboard/PhoneNumbersSettings.tsx");
    assert.equal(phones.includes('data-testid="settings-clinic-phones"'), true);
    assert.equal(phones.includes('id="clinicPhone"'), false);
  });
});
