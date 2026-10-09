import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTIONS,
  parseSettingsSection,
  SETTINGS_PATH,
  legacySettingsRedirect,
  settingsSectionHref,
} from "../../lib/settings-sections";

describe("settings sections (sidebar)", () => {
  it("lists the sidebar sections in order", () => {
    assert.deepEqual(
      SETTINGS_SECTIONS.map((s) => s.id),
      ["clinics", "services", "profile", "contact", "promote", "plan", "account"],
    );
  });

  it("gives promoting the practice its own section, apart from Account", () => {
    assert.equal(SETTINGS_SECTIONS.find((s) => s.id === "promote")?.label, "Promote");
    assert.equal(parseSettingsSection("promote"), "promote");
  });

  it("gives every section a label", () => {
    for (const section of SETTINGS_SECTIONS) {
      assert.ok(section.label.trim().length > 0, section.id);
    }
  });

  it("opens Clinics when no section is asked for", () => {
    assert.equal(DEFAULT_SETTINGS_SECTION, "clinics");
    assert.equal(parseSettingsSection(undefined), "clinics");
    assert.equal(parseSettingsSection(null), "clinics");
    assert.equal(parseSettingsSection(""), "clinics");
  });

  it("has no Availability section: Clinics shows the same per clinic (user, 2026-10-09)", () => {
    assert.equal(SETTINGS_SECTIONS.some((s) => (s.id as string) === "availability"), false);
    assert.equal(parseSettingsSection("availability"), "clinics");
    assert.equal(legacySettingsRedirect({ section: "availability" }), "/settings");
  });

  it("reads a known section from the URL", () => {
    assert.equal(parseSettingsSection("clinics"), "clinics");
    assert.equal(parseSettingsSection("profile"), "profile");
    assert.equal(parseSettingsSection(" Contact "), "contact");
  });

  it("uses the first value when the param repeats", () => {
    assert.equal(parseSettingsSection(["services", "profile"]), "services");
  });

  it("falls back to the default for an unknown section", () => {
    assert.equal(parseSettingsSection("billing"), "clinics");
    assert.equal(parseSettingsSection("__proto__"), "clinics");
  });

  it("lives at /settings, not under the agenda", () => {
    assert.equal(SETTINGS_PATH, "/settings");
  });

  it("links each section; the default one has no query", () => {
    assert.equal(settingsSectionHref("clinics"), "/settings");
    assert.equal(settingsSectionHref("services"), "/settings?section=services");
    assert.equal(settingsSectionHref("account"), "/settings?section=account");
  });

  it("sends the old /agenda/settings links to the same section", () => {
    assert.equal(legacySettingsRedirect({}), "/settings");
    assert.equal(legacySettingsRedirect({ section: "services" }), "/settings?section=services");
    assert.equal(legacySettingsRedirect({ section: ["profile", "x"] }), "/settings?section=profile");
    assert.equal(legacySettingsRedirect({ section: "nope" }), "/settings");
  });
});
