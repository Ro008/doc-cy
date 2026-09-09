import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("settings public Call autosave", () => {
  it("saves the Call switch without the full settings form", () => {
    const form = fs.readFileSync(
      path.join(repoRoot, "components/dashboard/SettingsForm.tsx"),
      "utf8",
    );
    const phones = fs.readFileSync(
      path.join(repoRoot, "components/dashboard/PhoneNumbersSettings.tsx"),
      "utf8",
    );
    const route = fs.readFileSync(
      path.join(repoRoot, "app/api/doctor-settings/public-phone/route.ts"),
      "utf8",
    );

    assert.equal(form.includes("/api/doctor-settings/public-phone"), true);
    assert.equal(form.includes("persistPublicCallSettings"), true);
    assert.equal(phones.includes("Saves immediately."), true);
    assert.equal(phones.includes('role="switch"'), true);

    assert.equal(route.includes("show_phone_public"), true);
    assert.equal(route.includes("public_phone_source"), true);
    assert.equal(route.includes("weekly_schedule"), false);
    assert.equal(route.includes("clinicAddress"), false);
  });
});
