import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPOINTMENT_LINK_GRACE_DAYS,
  appointmentCalendarPath,
  appointmentRequestSentQuery,
  isAppointmentLinkExpired,
  signAppointmentLink,
  verifyAppointmentLink,
} from "../../lib/appointment-links";

const SECRET = "test-secret-not-a-real-key";
const ID = "3f2b9c1e-7a4d-4e21-9b6f-2c8e5d1a0f47";
const OTHER_ID = "3f2b9c1e-7a4d-4e21-9b6f-2c8e5d1a0f48";

describe("signAppointmentLink / verifyAppointmentLink", () => {
  it("verifies a signature it issued for the same id and audience", () => {
    const sig = signAppointmentLink(ID, "patient", SECRET);
    assert.ok(sig);
    assert.equal(verifyAppointmentLink({ id: ID, audience: "patient", sig, secret: SECRET }), true);
  });

  it("is deterministic and URL-safe", () => {
    const a = signAppointmentLink(ID, "professional", SECRET);
    const b = signAppointmentLink(ID, "professional", SECRET);
    assert.equal(a, b);
    assert.match(a ?? "", /^[A-Za-z0-9_-]{22}$/);
  });

  it("rejects a patient signature used for the professional's version", () => {
    const sig = signAppointmentLink(ID, "patient", SECRET);
    assert.equal(
      verifyAppointmentLink({ id: ID, audience: "professional", sig, secret: SECRET }),
      false,
    );
  });

  it("rejects a request-sent signature used for a calendar download", () => {
    const sig = signAppointmentLink(ID, "request-sent", SECRET);
    assert.equal(verifyAppointmentLink({ id: ID, audience: "patient", sig, secret: SECRET }), false);
  });

  it("rejects a signature for another appointment", () => {
    const sig = signAppointmentLink(ID, "patient", SECRET);
    assert.equal(
      verifyAppointmentLink({ id: OTHER_ID, audience: "patient", sig, secret: SECRET }),
      false,
    );
  });

  it("rejects a signature made with another secret", () => {
    const sig = signAppointmentLink(ID, "patient", "some-other-secret");
    assert.equal(verifyAppointmentLink({ id: ID, audience: "patient", sig, secret: SECRET }), false);
  });

  it("rejects a missing, empty or malformed signature without throwing", () => {
    for (const sig of [null, undefined, "", "short", "x".repeat(200), "not base64 !!"]) {
      assert.equal(
        verifyAppointmentLink({ id: ID, audience: "patient", sig, secret: SECRET }),
        false,
        `sig=${String(sig)}`,
      );
    }
  });

  it("signs nothing and verifies nothing without a secret", () => {
    assert.equal(signAppointmentLink(ID, "patient", ""), null);
    const sig = signAppointmentLink(ID, "patient", SECRET);
    assert.equal(verifyAppointmentLink({ id: ID, audience: "patient", sig, secret: "" }), false);
  });
});

describe("isAppointmentLinkExpired", () => {
  const appointmentIso = "2026-10-03T07:00:00.000Z";
  const at = new Date(appointmentIso).getTime();
  const day = 24 * 60 * 60 * 1000;

  it("keeps links valid for 7 days after the appointment", () => {
    assert.equal(APPOINTMENT_LINK_GRACE_DAYS, 7);
  });

  it("is valid before the appointment", () => {
    assert.equal(isAppointmentLinkExpired(appointmentIso, new Date(at - 30 * day)), false);
  });

  it("is valid exactly 7 days after the appointment", () => {
    assert.equal(isAppointmentLinkExpired(appointmentIso, new Date(at + 7 * day)), false);
  });

  it("expires just after 7 days", () => {
    assert.equal(isAppointmentLinkExpired(appointmentIso, new Date(at + 7 * day + 1)), true);
  });

  it("treats an unreadable date as expired", () => {
    assert.equal(isAppointmentLinkExpired("not a date", new Date(at)), true);
  });
});

describe("link builders", () => {
  it("builds a signed patient calendar path", () => {
    const path = appointmentCalendarPath(ID, "patient", SECRET);
    const sig = signAppointmentLink(ID, "patient", SECRET);
    assert.equal(path, `/api/appointments/${ID}/calendar?audience=patient&sig=${sig}`);
  });

  it("builds a signed professional calendar path", () => {
    const path = appointmentCalendarPath(ID, "professional", SECRET);
    const sig = signAppointmentLink(ID, "professional", SECRET);
    assert.equal(path, `/api/appointments/${ID}/calendar?audience=professional&sig=${sig}`);
  });

  it("builds the request-sent query with appointmentId first", () => {
    const query = appointmentRequestSentQuery(ID, SECRET);
    const sig = signAppointmentLink(ID, "request-sent", SECRET);
    assert.equal(query, `appointmentId=${ID}&sig=${sig}`);
  });

  it("returns null when it can't sign", () => {
    assert.equal(appointmentCalendarPath(ID, "patient", ""), null);
    assert.equal(appointmentRequestSentQuery(ID, ""), null);
  });
});
