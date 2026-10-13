import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  manualBookingPermission,
  onlineBookingPermission,
  resumeOnlineBookingsPermission,
} from "../../lib/booking-permission";

/**
 * Who can be booked (user, 2026-10-02):
 * - Online: registered, pro access live (now <= pro_access_until), clinic not paused,
 *   clinic not archived.
 * - Manual: registered, pro access live, clinic not archived. Pausing does NOT block
 *   manual bookings (phone / walk-in).
 * - Access expired: nothing new, online or manual.
 */
const NOW = new Date("2026-10-04T10:00:00Z");
const LIVE = "2026-12-31T00:00:00Z";
const ENDED = "2026-10-01T00:00:00Z";

const base = {
  isRegistered: true,
  proAccessUntil: LIVE,
  clinicPaused: false,
  clinicArchived: false,
};

describe("onlineBookingPermission", () => {
  it("allows a registered professional with live access at an open clinic", () => {
    assert.deepEqual(onlineBookingPermission(base, NOW), { allowed: true });
  });

  it("refuses an unregistered listing", () => {
    assert.deepEqual(onlineBookingPermission({ ...base, isRegistered: false }, NOW), {
      allowed: false,
      reason: "not_registered",
    });
  });

  it("refuses when access has ended or was never given", () => {
    assert.deepEqual(onlineBookingPermission({ ...base, proAccessUntil: ENDED }, NOW), {
      allowed: false,
      reason: "access_expired",
    });
    assert.deepEqual(onlineBookingPermission({ ...base, proAccessUntil: null }, NOW), {
      allowed: false,
      reason: "access_expired",
    });
  });

  it("still allows at the exact moment access ends", () => {
    assert.deepEqual(
      onlineBookingPermission({ ...base, proAccessUntil: NOW.toISOString() }, NOW),
      { allowed: true },
    );
  });

  it("refuses a paused clinic", () => {
    assert.deepEqual(onlineBookingPermission({ ...base, clinicPaused: true }, NOW), {
      allowed: false,
      reason: "clinic_paused",
    });
  });

  it("refuses an archived clinic", () => {
    assert.deepEqual(onlineBookingPermission({ ...base, clinicArchived: true }, NOW), {
      allowed: false,
      reason: "clinic_archived",
    });
  });

  it("reports access before the clinic state", () => {
    assert.deepEqual(
      onlineBookingPermission({ ...base, proAccessUntil: ENDED, clinicPaused: true }, NOW),
      { allowed: false, reason: "access_expired" },
    );
  });
});

describe("manualBookingPermission", () => {
  it("allows a paused clinic (phone / walk-in bookings)", () => {
    assert.deepEqual(manualBookingPermission({ ...base, clinicPaused: true }, NOW), { allowed: true });
  });

  it("refuses when access has ended", () => {
    assert.deepEqual(manualBookingPermission({ ...base, proAccessUntil: ENDED }, NOW), {
      allowed: false,
      reason: "access_expired",
    });
  });

  it("refuses an archived clinic or an unregistered profile", () => {
    assert.deepEqual(manualBookingPermission({ ...base, clinicArchived: true }, NOW), {
      allowed: false,
      reason: "clinic_archived",
    });
    assert.deepEqual(manualBookingPermission({ ...base, isRegistered: false }, NOW), {
      allowed: false,
      reason: "not_registered",
    });
  });
});

describe("resumeOnlineBookingsPermission", () => {
  // Unpausing needs live access too (user, 2026-10-02): with access ended the Settings
  // toggles are off and disabled, and the server refuses the write.
  it("allows a registered professional with live access", () => {
    assert.deepEqual(resumeOnlineBookingsPermission({ isRegistered: true, proAccessUntil: LIVE }, NOW), {
      allowed: true,
    });
  });

  it("refuses when access has ended or was never given", () => {
    assert.deepEqual(resumeOnlineBookingsPermission({ isRegistered: true, proAccessUntil: ENDED }, NOW), {
      allowed: false,
      reason: "access_expired",
    });
    assert.deepEqual(resumeOnlineBookingsPermission({ isRegistered: true, proAccessUntil: null }, NOW), {
      allowed: false,
      reason: "access_expired",
    });
  });

  it("refuses an unregistered profile", () => {
    assert.deepEqual(resumeOnlineBookingsPermission({ isRegistered: false, proAccessUntil: LIVE }, NOW), {
      allowed: false,
      reason: "not_registered",
    });
  });
});
