import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGoogleCalendarUrl, getCalendarEventDetails } from "../../lib/patient-calendar-event";

const MAPS = "https://maps.app.goo.gl/abc123";
const doctor = {
  name: "Dr Maria Merakli",
  specialty: "Orthodontics",
  phone: "99526252",
  clinic_name: "Maria Merakli Clinic",
  clinic_address: "Spyridonos Trikoupi 21, Lakatameia, 2311, Nicosia",
  maps_url: MAPS,
};
const appt = { id: "a1", appointment_datetime: "2026-10-15T07:00:00.000Z" };

describe("patient calendar event", () => {
  it("title is generic (not the specialty) and keeps the icon", () => {
    const { title } = getCalendarEventDetails(appt, doctor, null, { includeDirectClinicContact: true });
    assert.equal(title, "🩺 Doctor appointment: Maria Merakli");
    const noSpecialty = getCalendarEventDetails(appt, { ...doctor, specialty: null });
    assert.equal(noSpecialty.title, "🩺 Doctor appointment: Maria Merakli");
  });

  it("location is the clinic name and address", () => {
    const { location } = getCalendarEventDetails(appt, doctor);
    assert.equal(location, "Maria Merakli Clinic, Spyridonos Trikoupi 21, Lakatameia, 2311, Nicosia");
    assert.equal(getCalendarEventDetails(appt, { ...doctor, clinic_name: null }).location, doctor.clinic_address);
  });

  it("description lists clinic, address, map pin, phone with +357, reason and the DocCy line", () => {
    const { description } = getCalendarEventDetails(appt, doctor, { reason: "Toothache" }, { includeDirectClinicContact: true });
    assert.match(description, /Reason: Toothache/);
    assert.match(description, /Clinic: Maria Merakli Clinic/);
    assert.match(description, /Address: Spyridonos Trikoupi 21/);
    assert.ok(description.includes(`Map: ${MAPS}`));
    assert.match(description, /Phone: \+357 99 526252/);
    assert.match(description, /Confirmed via mydoccy\.com/);
    assert.match(description, /To change or cancel/);
  });

  it("omits lines it has no data for", () => {
    const { description } = getCalendarEventDetails(
      appt,
      { name: "Dr Maria Merakli" },
      null,
      { includeDirectClinicContact: true },
    );
    assert.equal(description.includes("Map:"), false);
    assert.equal(description.includes("Phone:"), false);
    assert.equal(description.includes("Reason:"), false);
    assert.match(description, /Confirmed via mydoccy\.com/);
  });

  it("pending requests are described as managed via DocCy", () => {
    const { description } = getCalendarEventDetails(appt, doctor);
    assert.match(description, /Request managed via mydoccy\.com/);
  });

  it("google link carries title, location and the map pin in the details", () => {
    const cal = getCalendarEventDetails(appt, doctor, null, { includeDirectClinicContact: true });
    const url = new URL(
      buildGoogleCalendarUrl({
        ...cal,
        startUtc: new Date(appt.appointment_datetime),
        endUtc: new Date("2026-10-15T07:30:00.000Z"),
      }),
    );
    assert.equal(url.searchParams.get("text"), cal.title);
    assert.equal(url.searchParams.get("location"), cal.location);
    assert.ok(url.searchParams.get("details")?.includes(MAPS));
  });
});
