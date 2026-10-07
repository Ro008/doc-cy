import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AGENDA_CLINIC_EVENT_COLORS,
  PROFILE_CLINIC_ACCENTS,
  WORKPLACE_ACCENTS,
} from "../../lib/doctor-locations";

/**
 * Amber means "pending request" on the agenda, so no clinic may be given it (user, 2026-10-07).
 * A clinic in amber looked like a pending request.
 */
describe("clinic colours", () => {
  it("never use amber (reserved for pending requests)", () => {
    for (const palette of [AGENDA_CLINIC_EVENT_COLORS, WORKPLACE_ACCENTS, PROFILE_CLINIC_ACCENTS]) {
      assert.equal(JSON.stringify(palette).includes("amber"), false);
    }
  });

  it("keeps five distinct colours in every palette, in the same order", () => {
    assert.equal(AGENDA_CLINIC_EVENT_COLORS.length, 5);
    assert.equal(new Set(AGENDA_CLINIC_EVENT_COLORS.map((c) => c.swatch)).size, 5);
    assert.equal(WORKPLACE_ACCENTS.length, 5);
    assert.equal(PROFILE_CLINIC_ACCENTS.length, 5);
    assert.deepEqual(
      AGENDA_CLINIC_EVENT_COLORS.map((c) => c.swatch),
      WORKPLACE_ACCENTS.map((c) => c.tint),
    );
  });
});
