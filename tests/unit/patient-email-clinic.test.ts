import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  patientClinicBlockHtml,
  patientClinicBlockText,
  patientClinicProfileUrl,
  loadPatientEmailClinic,
} from "../../lib/patient-email-clinic";

/**
 * The clinic block every patient email carries (user, 2026-10-07): the clinic name linking to
 * the professional's profile, the address linking to the Maps pin, and the phone with the
 * Cyprus prefix linking to call.
 */
const FULL = {
  name: "Maria Orthodontics",
  address: "Spyrou Kyprianou 81, Larnaka 6051, Cyprus",
  mapsUrl: "https://maps.app.goo.gl/abc123",
  phone: "22123123",
  profileUrl: "https://www.mydoccy.com/en/maria-merakli",
};

describe("patientClinicProfileUrl", () => {
  it("is the English public profile on the site", () => {
    assert.equal(patientClinicProfileUrl("https://www.mydoccy.com", "maria-merakli"), "https://www.mydoccy.com/en/maria-merakli");
  });
  it("is null without a slug", () => {
    assert.equal(patientClinicProfileUrl("https://www.mydoccy.com", null), null);
    assert.equal(patientClinicProfileUrl("https://www.mydoccy.com", "  "), null);
  });
});

describe("patientClinicBlockHtml", () => {
  const html = patientClinicBlockHtml(FULL);
  it("links the clinic name to the profile", () => {
    assert.match(html, /<a href="https:\/\/www\.mydoccy\.com\/en\/maria-merakli"[^>]*>\s*<strong>Maria Orthodontics<\/strong>/);
  });
  it("links the address to the Maps pin", () => {
    assert.match(html, /<a href="https:\/\/maps\.app\.goo\.gl\/abc123"[^>]*>Spyrou Kyprianou 81, Larnaka 6051, Cyprus<\/a>/);
  });
  it("links the phone with +357 to call", () => {
    assert.match(html, /<a href="tel:\+35722123123"[^>]*>\+357 22 123123<\/a>/);
  });
  it("falls back to an address search when there is no pin", () => {
    const h = patientClinicBlockHtml({ ...FULL, mapsUrl: null });
    assert.match(h, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=Spyrou/);
  });
  it("shows the name as plain bold text without a profile", () => {
    const h = patientClinicBlockHtml({ ...FULL, profileUrl: null });
    assert.match(h, /<strong>Maria Orthodontics<\/strong>/);
    assert.equal(h.includes("/en/maria-merakli"), false);
  });
  it("leaves out the address and phone when missing", () => {
    const h = patientClinicBlockHtml({ name: "Maria Orthodontics" });
    assert.equal(h.includes("tel:"), false);
    assert.equal(h.includes("maps"), false);
    assert.match(h, /Maria Orthodontics/);
  });
  it("escapes the clinic name", () => {
    const h = patientClinicBlockHtml({ name: "A <b>&</b> B" });
    assert.equal(h.includes("<b>"), false);
    assert.match(h, /A &lt;b&gt;&amp;&lt;\/b&gt; B/);
  });
});

describe("patientClinicBlockText", () => {
  it("lists name, profile, address, map and phone", () => {
    const t = patientClinicBlockText(FULL);
    assert.match(t, /Clinic: Maria Orthodontics/);
    assert.match(t, /Profile: https:\/\/www\.mydoccy\.com\/en\/maria-merakli/);
    assert.match(t, /Address: Spyrou Kyprianou 81/);
    assert.match(t, /Maps: https:\/\/maps\.app\.goo\.gl\/abc123/);
    assert.match(t, /Phone: \+357 22 123123/);
  });
  it("skips what is missing", () => {
    assert.equal(patientClinicBlockText({ name: "Solo" }), "Clinic: Solo\n");
  });
});

describe("loadPatientEmailClinic", () => {
  function fake(row: unknown) {
    return {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
    } as never;
  }
  it("builds the block from the clinic row, its pin and the profile", async () => {
    const c = await loadPatientEmailClinic(
      fake({
        name: "Maria Orthodontics",
        address: "Spyrou Kyprianou 81",
        phone: "22123123",
        address_maps_link: "https://maps.app.goo.gl/abc123",
        latitude: null,
        longitude: null,
      }),
      { clinicId: "c1", professionalSlug: "maria-merakli", siteUrl: "https://www.mydoccy.com" },
    );
    assert.deepEqual(c, {
      name: "Maria Orthodontics",
      address: "Spyrou Kyprianou 81",
      mapsUrl: "https://maps.app.goo.gl/abc123",
      phone: "22123123",
      profileUrl: "https://www.mydoccy.com/en/maria-merakli",
    });
  });
  it("is null without a clinic id or row", async () => {
    assert.equal(await loadPatientEmailClinic(fake(null), { clinicId: null, professionalSlug: "x", siteUrl: "https://a.b" }), null);
    assert.equal(await loadPatientEmailClinic(fake(null), { clinicId: "c1", professionalSlug: "x", siteUrl: "https://a.b" }), null);
  });
});
