import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { stringifyJsonLd } from "../../lib/json-ld";
import { escapeIcsText } from "../../lib/ics-text";

/** Security review of the public profile (2026-10-11). */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

describe("JSON-LD inside <script> (stored XSS through a professional's own texts)", () => {
  const evil = { "@type": "Physician", name: "Dr X", service: "</script><script>alert(1)</script>" };

  it("never lets a text close the script tag", () => {
    const out = stringifyJsonLd(evil);
    assert.equal(out.includes("<"), false);
    assert.equal(/<\/script/i.test(out), false);
  });

  it("is still the same JSON for search engines", () => {
    assert.deepEqual(JSON.parse(stringifyJsonLd(evil)), evil);
  });

  it("the profile page writes its structured data through it", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    assert.match(page, /dangerouslySetInnerHTML=\{\{ __html: stringifyJsonLd\(item\) \}\}/);
    assert.equal(/__html: JSON\.stringify\(/.test(page), false);
  });
});

describe("calendar (.ics) text", () => {
  it("turns every kind of line break into an escaped \\n, so a patient's words can't add lines", () => {
    const out = escapeIcsText("Knee pain\r\nATTENDEE:mailto:x@evil.test\rURL:https://evil.test\nok");
    assert.equal(/[\r\n]/.test(out), false);
    assert.equal(out, "Knee pain\\nATTENDEE:mailto:x@evil.test\\nURL:https://evil.test\\nok");
  });

  it("escapes backslashes, commas and semicolons as RFC 5545 asks", () => {
    assert.equal(escapeIcsText("a\\b, c; d"), "a\\\\b\\, c\\; d");
  });

  it("the calendar route uses it", () => {
    const route = read("app/api/appointments/[id]/calendar/route.ts");
    assert.match(route, /from "@\/lib\/ics-text"/);
    assert.equal(/function escapeIcsText/.test(route), false);
  });
});
