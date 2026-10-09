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
  it("lists the sidebar sections in order: the practice first, account admin last (user, 2026-10-09)", () => {
    assert.deepEqual(
      SETTINGS_SECTIONS.map((s) => s.id),
      ["profile", "clinics", "services", "contact", "promote", "plan", "account"],
    );
  });

  it("starts the account group (Plan & billing, Account) after Promote", () => {
    const grouped = SETTINGS_SECTIONS.filter((s) => "group" in s && s.group === "account").map((s) => s.id);
    assert.deepEqual(grouped, ["plan", "account"]);
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

  it("opens Profile when no section is asked for", () => {
    assert.equal(DEFAULT_SETTINGS_SECTION, "profile");
    assert.equal(parseSettingsSection(undefined), "profile");
    assert.equal(parseSettingsSection(null), "profile");
    assert.equal(parseSettingsSection(""), "profile");
  });

  it("has no Availability section; its old links open Clinics, which shows the same per clinic (user, 2026-10-09)", () => {
    assert.equal(SETTINGS_SECTIONS.some((s) => (s.id as string) === "availability"), false);
    assert.equal(parseSettingsSection("availability"), "clinics");
    assert.equal(legacySettingsRedirect({ section: "availability" }), "/settings?section=clinics");
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
    assert.equal(parseSettingsSection("billing"), "profile");
    assert.equal(parseSettingsSection("__proto__"), "profile");
  });

  it("lives at /settings, not under the agenda", () => {
    assert.equal(SETTINGS_PATH, "/settings");
  });

  it("links each section; the default one has no query", () => {
    assert.equal(settingsSectionHref("profile"), "/settings");
    assert.equal(settingsSectionHref("clinics"), "/settings?section=clinics");
    assert.equal(settingsSectionHref("account"), "/settings?section=account");
  });

  it("sends the old /agenda/settings links to the same section", () => {
    assert.equal(legacySettingsRedirect({}), "/settings");
    assert.equal(legacySettingsRedirect({ section: "services" }), "/settings?section=services");
    assert.equal(legacySettingsRedirect({ section: ["plan", "x"] }), "/settings?section=plan");
    assert.equal(legacySettingsRedirect({ section: "nope" }), "/settings");
  });
});
