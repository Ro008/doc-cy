import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLINIC_ADD_REQUEST_TYPE,
  CLINIC_DETAILS_REQUEST_TYPE,
  clinicChangeLines,
  clinicChangesFromBody,
  clinicRequestDbErrorMessage,
  clinicRequestStates,
  newClinicDetailsFromBody,
  reviewedClinicChanges,
  reviewedNewClinic,
  type ClinicRequestRow,
  type NewClinicDetails,
} from "../../lib/clinic-requests";

/**
 * Settings → Clinics (user, 2026-10-11): a clinic DocCy does not have yet, and a change
 * to a clinic's name, address or phone, are requests a founder decides.
 */

const pin = {
  address: "  Agiou Athanasiou 12,  4102 Limassol ",
  latitude: 34.69,
  longitude: 33.05,
  placeId: "place-limassol",
  district: "Limassol",
  town: "Germasogeia",
};

const current = { name: "Limassol Skin Clinic", address: "Old Street 1, Limassol", phone: "25123456" };

describe("newClinicDetailsFromBody", () => {
  it("keeps a new clinic the way a clinic proposed at registration is kept", () => {
    assert.deepEqual(newClinicDetailsFromBody({ name: " Skin  Clinic ", phone: "+357 25 123456", location: pin }), {
      ok: true,
      details: {
        name: "Skin Clinic",
        address: "Agiou Athanasiou 12, 4102 Limassol",
        district: "Limassol",
        town: "Germasogeia",
        latitude: 34.69,
        longitude: 33.05,
        place_id: "place-limassol",
        phone: "25123456",
      },
    });
  });

  it("needs a name, a place in Cyprus with its pin, and a Cyprus landline or mobile", () => {
    const refused = (body: unknown) => {
      const result = newClinicDetailsFromBody(body);
      return result.ok === false ? result.message : "accepted";
    };
    assert.equal(refused({ name: "", phone: "25123456", location: pin }), "Enter the clinic name.");
    assert.equal(
      refused({ name: "x".repeat(121), phone: "25123456", location: pin }),
      "Keep the clinic name under 120 characters.",
    );
    assert.equal(
      refused({ name: "A", phone: "25123456", location: { ...pin, latitude: null } }),
      "Find the clinic on Google Maps or drop a pin first.",
    );
    assert.equal(
      refused({ name: "A", phone: "25123456", location: { ...pin, district: "Athens" } }),
      "Find the clinic on Google Maps or drop a pin first.",
    );
    assert.equal(refused({ name: "A", phone: "25123456" }), "Find the clinic on Google Maps or drop a pin first.");
    for (const phone of ["", "123", "+30 210 1234567", "80012345", "90123456"]) {
      assert.equal(refused({ name: "A", phone, location: pin }), "Enter a Cyprus landline or mobile, e.g. 25 123456.");
    }
    assert.equal(newClinicDetailsFromBody({ name: "A", phone: "99 123456", location: pin }).ok, true);
  });
});

describe("clinicChangesFromBody", () => {
  it("keeps only what differs from the clinic as it is", () => {
    assert.deepEqual(clinicChangesFromBody({ name: "Skin Clinic", phone: "25 123456" }, current), {
      ok: true,
      changes: { name: "Skin Clinic" },
    });
    assert.deepEqual(clinicChangesFromBody({ phone: "99123456" }, current), {
      ok: true,
      changes: { phone: "99123456" },
    });
  });

  it("takes a new address with its pin", () => {
    assert.deepEqual(clinicChangesFromBody({ address: pin.address, location: pin }, current), {
      ok: true,
      changes: {
        address: "Agiou Athanasiou 12, 4102 Limassol",
        location: { district: "Limassol", town: "Germasogeia", latitude: 34.69, longitude: 33.05, place_id: "place-limassol" },
      },
    });
    const noPin = clinicChangesFromBody({ address: "Somewhere else" }, current);
    assert.equal(noPin.ok === false && noPin.message, "Pick the address from the suggestions or drop a pin.");
  });

  it("keeps the address when only its pin was moved", () => {
    const here = { ...current, address: "Agiou Athanasiou 12, 4102 Limassol", latitude: 34.69, longitude: 33.05 };
    const same = clinicChangesFromBody({ address: pin.address, location: pin }, here);
    assert.equal(same.ok === false && same.message, "Change at least one detail.");
    const moved = clinicChangesFromBody({ address: pin.address, location: { ...pin, latitude: 34.6912 } }, here);
    assert.equal(moved.ok && moved.changes.address, "Agiou Athanasiou 12, 4102 Limassol");
    assert.equal(moved.ok && moved.changes.location?.latitude, 34.6912);
  });

  it("refuses a request that changes nothing, or holds something unusable", () => {
    const same = clinicChangesFromBody({ name: current.name, phone: current.phone }, current);
    assert.equal(same.ok === false && same.message, "Change at least one detail.");
    assert.equal(clinicChangesFromBody({}, current).ok, false);
    const badPhone = clinicChangesFromBody({ phone: "12" }, current);
    assert.equal(badPhone.ok === false && badPhone.message, "Enter a Cyprus landline or mobile, e.g. 25 123456.");
    const noName = clinicChangesFromBody({ name: "  " }, current);
    assert.equal(noName.ok === false && noName.message, "Enter the clinic name.");
  });
});

describe("clinicChangeLines", () => {
  it("lists what she is asking for, old to new", () => {
    assert.deepEqual(
      clinicChangeLines(current, { name: "Skin Clinic", address: "New Street 2", phone: "99123456" }),
      [
        { label: "Name", from: "Limassol Skin Clinic", to: "Skin Clinic" },
        { label: "Address", from: "Old Street 1, Limassol", to: "New Street 2" },
        { label: "Phone", from: "+357 25 123456", to: "+357 99 123456" },
      ],
    );
    assert.deepEqual(clinicChangeLines(current, {}), []);
    // The same address again: only its pin was moved.
    assert.deepEqual(clinicChangeLines(current, { address: current.address }), [
      { label: "Map pin", from: "where it is now", to: "moved to a new spot" },
    ]);
    assert.deepEqual(clinicChangeLines({ ...current, phone: "" }, { phone: "25123456" }), [
      { label: "Phone", from: "none", to: "+357 25 123456" },
    ]);
  });
});

const row = (patch: Partial<ClinicRequestRow>): ClinicRequestRow => ({
  id: "r",
  request_type: CLINIC_ADD_REQUEST_TYPE,
  status: "pending",
  details: {},
  created_at: "2026-10-11T08:00:00Z",
  decided_at: null,
  decision_note: null,
  ...patch,
});

describe("clinicRequestStates", () => {
  it("shows nothing when she never asked", () => {
    assert.deepEqual(clinicRequestStates([]), { add: { pending: null, denied: null }, details: {} });
  });

  it("shows her waiting new clinic, or the reason her latest one was denied", () => {
    const waiting = clinicRequestStates([
      row({ id: "old", status: "rejected", decision_note: "No", created_at: "2026-10-01T08:00:00Z" }),
      row({ id: "new", details: { name: "New Clinic", address: "5 Road" } }),
    ]);
    assert.deepEqual(waiting.add, {
      pending: { id: "new", createdAt: "2026-10-11T08:00:00Z", name: "New Clinic", address: "5 Road" },
      denied: null,
    });
    const denied = clinicRequestStates([
      row({ id: "d", status: "rejected", decision_note: "Not found", decided_at: "2026-10-12T08:00:00Z", details: { name: "X" } }),
    ]);
    assert.deepEqual(denied.add, {
      pending: null,
      denied: { id: "d", decidedAt: "2026-10-12T08:00:00Z", reason: "Not found", name: "X" },
    });
    // Approved or withdrawn: nothing left to show.
    assert.deepEqual(clinicRequestStates([row({ status: "approved" })]).add, { pending: null, denied: null });
    assert.deepEqual(clinicRequestStates([row({ status: "withdrawn" })]).add, { pending: null, denied: null });
  });

  it("keeps details requests apart by clinic, the latest of each", () => {
    const states = clinicRequestStates([
      row({
        id: "a1",
        request_type: CLINIC_DETAILS_REQUEST_TYPE,
        details: { clinic_id: "clinic-a", changes: { name: "A2", phone: "25123456", location: {} } },
      }),
      row({
        id: "a0",
        request_type: CLINIC_DETAILS_REQUEST_TYPE,
        status: "rejected",
        created_at: "2026-10-01T08:00:00Z",
        details: { clinic_id: "clinic-a", changes: { name: "A1" } },
      }),
      row({
        id: "b1",
        request_type: CLINIC_DETAILS_REQUEST_TYPE,
        status: "rejected",
        decision_note: "Wrong number",
        decided_at: "2026-10-12T08:00:00Z",
        details: { clinic_id: "clinic-b", changes: { phone: "26123456" } },
      }),
      row({ id: "c1", request_type: CLINIC_DETAILS_REQUEST_TYPE, status: "approved", details: { clinic_id: "clinic-c" } }),
    ]);
    assert.deepEqual(states.details, {
      "clinic-a": {
        pending: { id: "a1", createdAt: "2026-10-11T08:00:00Z", changes: { name: "A2", phone: "25123456" } },
        denied: null,
      },
      "clinic-b": {
        pending: null,
        denied: { id: "b1", decidedAt: "2026-10-12T08:00:00Z", reason: "Wrong number", name: null },
      },
    });
  });
});

const asked: NewClinicDetails = {
  name: "skin clinic",
  address: "5 Road, Limassol",
  district: "Limassol",
  town: null,
  latitude: 34.7,
  longitude: 33.0,
  place_id: null,
  phone: "25123456",
};

describe("what a founder approves", () => {
  it("a new clinic as asked, or corrected", () => {
    assert.deepEqual(reviewedNewClinic(asked, {}), { ok: true, details: asked, corrected: null });
    assert.deepEqual(reviewedNewClinic(asked, { name: "skin clinic", phone: "25 123456" }).ok && true, true);
    const fixed = reviewedNewClinic(asked, { name: " Skin Clinic ", phone: "25 654321" });
    assert.deepEqual(fixed, {
      ok: true,
      details: { ...asked, name: "Skin Clinic", phone: "25654321" },
      corrected: { ...asked, name: "Skin Clinic", phone: "25654321" },
    });
    assert.equal(reviewedNewClinic(asked, { name: "" }).ok, false);
    assert.equal(reviewedNewClinic(asked, { phone: "1" }).ok, false);
    assert.equal(reviewedNewClinic(asked, { address: " " }).ok, false);
  });

  it("clinic changes as asked, or corrected, never more than she asked", () => {
    assert.deepEqual(reviewedClinicChanges({ name: "A" }, {}), { ok: true, changes: { name: "A" }, corrected: false });
    assert.deepEqual(reviewedClinicChanges({ name: "A" }, { name: "A", phone: "25123456" }), {
      ok: true,
      changes: { name: "A" },
      corrected: false,
    });
    assert.deepEqual(reviewedClinicChanges({ name: "a clinic", phone: "25123456" }, { name: "A Clinic" }), {
      ok: true,
      changes: { name: "A Clinic", phone: "25123456" },
      corrected: true,
    });
    assert.equal(reviewedClinicChanges({ phone: "25123456" }, { phone: "x" }).ok, false);
    assert.equal(reviewedClinicChanges({ name: "A" }, { name: " " }).ok, false);
  });
});

describe("clinicRequestDbErrorMessage", () => {
  it("tells her why a request was not sent", () => {
    assert.deepEqual(clinicRequestDbErrorMessage({ code: "23505" }, "submit"), {
      status: 409,
      message: "You already have a request waiting. Withdraw it to send a new one.",
    });
    assert.equal(clinicRequestDbErrorMessage({ code: "23514" }, "submit").status, 409);
    assert.equal(clinicRequestDbErrorMessage({ code: "P0002" }, "submit").status, 404);
    assert.equal(clinicRequestDbErrorMessage({ code: "22023" }, "submit").status, 400);
    assert.equal(clinicRequestDbErrorMessage({ code: "55000" }, "withdraw").status, 409);
  });

  it("tells a founder what stops an approval", () => {
    const decide = (code: string, message = "") => clinicRequestDbErrorMessage({ code, message }, "decide");
    assert.equal(decide("42501").status, 403);
    assert.match(decide("55000", "she already has 5 clinics: deny the request").message, /already has 5 clinics/);
    assert.match(decide("55000", "she already works at this clinic: deny").message, /already works at that clinic/);
    assert.match(decide("55000", "she no longer works at this clinic: deny").message, /has left the clinic/);
    assert.match(decide("55000", "the clinic changed since this request was made").message, /changed since/);
    assert.match(decide("55000", "request x is already approved").message, /already decided/);
    assert.match(decide("P0002", "clinic 123 not found").message, /DocCy clinic does not exist/);
    assert.equal(decide("22023").status, 400);
  });
});
