import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { htmlLangFromPathname } from "@/lib/html-lang";

describe("htmlLangFromPathname", () => {
  it("keeps English for finder and unprefixed product routes", () => {
    assert.equal(htmlLangFromPathname("/"), "en");
    assert.equal(htmlLangFromPathname("/larnaca/dentistry"), "en");
    assert.equal(htmlLangFromPathname("/en/andreas-nikos"), "en");
    assert.equal(htmlLangFromPathname("/for-professionals"), "en");
    assert.equal(htmlLangFromPathname("/privacy"), "en");
  });

  it("uses Greek only for /el booking and marketing URLs", () => {
    assert.equal(htmlLangFromPathname("/el"), "el");
    assert.equal(htmlLangFromPathname("/el/andreas-nikos"), "el");
  });
});
