import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cancelConfirmedVisitCopy } from "../../lib/cancel-visit-copy";

/**
 * Cancelling a confirmed visit: with an email DocCy tells the patient; a manual visit without
 * one can't be emailed, so the dialog says to call and shows the phone (manual test F4, 2026-10-08).
 */
describe("cancelConfirmedVisitCopy", () => {
  it("promises an email only when there is one", () => {
    const copy = cancelConfirmedVisitCopy({ patientEmail: "maria@example.com", patientPhone: "+357 99 123456" });
    assert.equal(copy.notifiesByEmail, true);
    assert.match(copy.intro, /will receive an email/i);
    assert.equal(copy.confirmLabel, "Cancel & notify");
    assert.equal(copy.call, null);
  });

  it("without an email: no email promise, call them instead, with the phone", () => {
    const copy = cancelConfirmedVisitCopy({ patientEmail: "  ", patientPhone: "+357 99 765432" });
    assert.equal(copy.notifiesByEmail, false);
    assert.doesNotMatch(copy.intro, /will receive an email/i);
    assert.match(copy.intro, /no email/i);
    assert.match(copy.intro, /call/i);
    assert.deepEqual(copy.call, { label: "+357 99 765432", href: "tel:+35799765432" });
    assert.equal(copy.confirmLabel, "Cancel visit");
  });

  it("without an email or a phone it still says nobody is told", () => {
    const copy = cancelConfirmedVisitCopy({ patientEmail: null, patientPhone: "" });
    assert.equal(copy.call, null);
    assert.match(copy.intro, /no email/i);
  });
});
