import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPatientRescheduleProposalEmailContent } from "../../lib/send-patient-reschedule-proposal-email";

/**
 * The proposal email names the clinic of the suggested times, with the address linked to its
 * Maps pin and the clinic phone; when that clinic isn't the one the patient asked for, it says
 * so up front (manual test D5, user 2026-10-07).
 */
const base = {
  patientName: "Zack",
  chooseUrl: "https://www.mydoccy.com/booking/choose?token=tok",
  proposalExpiresAtIso: "2026-10-08T07:30:00Z",
  doctorName: "Harrison Ford",
  slotLabelsCyprus: ["Thursday, 8 October 2026 at 12:30", "Thursday, 8 October 2026 at 13:00"],
  clinic: {
    name: "WellClub",
    address: "Chlorakas Ave 67, Chlorakas",
    mapsUrl: "https://maps.google.com/?cid=123",
    phone: "+357 26 123456",
  },
};

describe("proposal email clinic", () => {
  it("shows the clinic, its address as a Maps link and its phone", () => {
    const email = buildPatientRescheduleProposalEmailContent(base);
    assert.ok(email.html.includes('href="https://maps.google.com/?cid=123"'), "maps link");
    assert.ok(email.html.includes("Chlorakas Ave 67, Chlorakas"), "address");
    assert.match(email.html, /href="tel:\+35726123456"/);
    for (const body of [email.text, email.html]) {
      assert.ok(body.includes("WellClub"), "clinic name");
      assert.ok(body.includes("26 123456"), "phone");
    }
  });

  it("says plainly when the times are at another clinic than the one asked for", () => {
    const email = buildPatientRescheduleProposalEmailContent({ ...base, requestedClinicName: "Feretis Othonos" });
    for (const body of [email.text, email.html]) {
      assert.match(body, /different clinic/i);
      assert.ok(body.includes("Feretis Othonos"), "the clinic they asked for");
      assert.ok(body.includes("WellClub"), "the new clinic");
    }
    assert.match(email.subject, /another clinic/i);
  });

  it("says nothing about a change when it is the same clinic", () => {
    const email = buildPatientRescheduleProposalEmailContent({ ...base, requestedClinicName: null });
    for (const body of [email.text, email.html]) assert.doesNotMatch(body, /different clinic/i);
    assert.doesNotMatch(email.subject, /another clinic/i);
  });

  it("still works without a phone", () => {
    const email = buildPatientRescheduleProposalEmailContent({ ...base, clinic: { ...base.clinic, phone: null } });
    assert.doesNotMatch(email.html, /tel:/);
  });
});
