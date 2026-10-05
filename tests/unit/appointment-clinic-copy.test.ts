import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appointmentClinicCopy,
  loadAppointmentClinicPhone,
  appointmentClinicCopyFromAddress,
  formatAppointmentClinicEmailHtml,
  formatAppointmentClinicEmailText,
} from "../../lib/appointment-clinic-copy";

describe("appointment-clinic-copy", () => {
  it("uses the appointment's clinic (clinics.id): its name and address", () => {
    const clinic = appointmentClinicCopy({
      locations: [
        {
          id: "loc-1",
          clinic_id: "clinic-1",
          clinic_name: "City Clinic",
          label: "City clinic",
          clinic_address: "1 Ledra Street, Nicosia",
          is_primary: true,
          sort_order: 0,
        },
        {
          id: "loc-2",
          clinic_id: "clinic-2",
          clinic_name: "Harbour Medical Centre",
          label: "Coast clinic",
          clinic_address: "10 Harbour Road, Limassol",
          is_primary: false,
          sort_order: 1,
        },
      ],
      clinicId: "clinic-2",
    });

    assert.equal(clinic.clinicName, "Harbour Medical Centre");
    assert.equal(clinic.locationId, "loc-2");
    assert.equal(clinic.address, "10 Harbour Road, Limassol");
    assert.match(clinic.mapsUrl, /maps\.google\.com/);
    assert.match(clinic.mapsUrl, /Harbour/);
  });

  it("links the clinic's stored Maps pin, showing the address as the text", () => {
    const clinic = appointmentClinicCopy({
      locations: [
        {
          id: "loc-1",
          clinic_id: "clinic-1",
          clinic_name: "Maria Merakli",
          label: null,
          clinic_address: "Spyridonos Trikoupi 21, Flat No. 202, Lakatameia, 2311, Nicosia",
          clinic_maps_link: "https://www.google.com/maps?q=35.110358,33.308237",
          latitude: 35.110358,
          longitude: 33.308237,
          is_primary: true,
          sort_order: 0,
        },
      ],
      clinicId: "clinic-1",
    });
    assert.equal(clinic.mapsUrl, "https://www.google.com/maps?q=35.110358,33.308237");
    const html = formatAppointmentClinicEmailHtml(clinic);
    assert.match(html, /href="https:\/\/www\.google\.com\/maps\?q=35\.110358,33\.308237"/);
    assert.match(html, />Spyridonos Trikoupi 21, Flat No\. 202, Lakatameia, 2311, Nicosia<\/a>/);
  });

  it("the address-only fallback also takes the stored pin", () => {
    const clinic = appointmentClinicCopyFromAddress({
      clinicName: "Maria Merakli",
      address: "Spyridonos Trikoupi 21, Lakatameia",
      mapsLink: "https://www.google.com/maps?q=35.110358,33.308237",
    });
    assert.equal(clinic.mapsUrl, "https://www.google.com/maps?q=35.110358,33.308237");
  });

  it("falls back to Clinic N when label is empty", () => {
    const clinic = appointmentClinicCopy({
      locations: [
        {
          id: "loc-1",
          label: null,
          clinic_address: "1 Ledra Street, Nicosia",
          is_primary: true,
          sort_order: 0,
        },
        {
          id: "loc-2",
          clinic_id: "clinic-2",
          label: null,
          clinic_address: "10 Harbour Road, Limassol",
          is_primary: false,
          sort_order: 1,
        },
      ],
      clinicId: "clinic-2",
    });

    assert.equal(clinic.clinicName, "Clinic 2");
    assert.equal(clinic.address, "10 Harbour Road, Limassol");
  });

  it("renders clickable address in html email block", () => {
    const clinic = appointmentClinicCopyFromAddress({
      clinicName: "Clinic 2",
      address: "10 Harbour Road, Limassol",
    });
    const text = formatAppointmentClinicEmailText(clinic);
    const html = formatAppointmentClinicEmailHtml(clinic);

    assert.match(text, /Clinic: Clinic 2/);
    assert.match(text, /Address: 10 Harbour Road, Limassol/);
    assert.match(html, /Clinic 2/);
    assert.match(html, /href="https:\/\/maps\.google\.com\/\?q=/);
    assert.match(html, /10 Harbour Road, Limassol/);
  });

  it("does not fall back to Evangelismos when address is missing", () => {
    const clinic = appointmentClinicCopy({
      locations: [
        {
          id: "loc-1",
          label: "City clinic",
          clinic_address: null,
          is_primary: true,
          sort_order: 0,
        },
      ],
    });

    assert.equal(clinic.clinicName, "City clinic");
    assert.equal(clinic.address, "");
    assert.equal(clinic.mapsUrl, "");
    assert.doesNotMatch(clinic.address, /Evangelismos/i);
  });
});

/**
 * Point E5: the phone patients see after booking is the appointment's clinic phone,
 * never `professionals.phone` (which held the professional's personal mobile).
 */
describe("loadAppointmentClinicPhone", () => {
  function fakeClient(rows: Record<string, unknown>) {
    const seen: string[] = [];
    const client = {
      from(table: string) {
        seen.push(`from ${table}`);
        const builder = {
          select(columns: string) {
            seen.push(`select ${columns}`);
            return builder;
          },
          eq(column: string, value: string) {
            seen.push(`${column}=${value}`);
            return builder;
          },
          async maybeSingle() {
            const id = seen.find((s) => s.startsWith("id="))?.slice(3) ?? "";
            return { data: rows[id] ?? null, error: null };
          },
        };
        return builder;
      },
    };
    return { client, seen };
  }

  it("reads the phone of the clinic behind the appointment's clinic link", async () => {
    const { client, seen } = fakeClient({
      "loc-2": { clinics: { phone: " 25202712 ", is_archived: false } },
    });
    assert.equal(await loadAppointmentClinicPhone(client as never, "loc-2"), "25202712");
    assert.deepEqual(seen, [
      "from professional_clinics",
      "select clinics ( phone, is_archived )",
      "id=loc-2",
    ]);
  });

  it("is null without a link, for an archived clinic or a clinic without a phone", async () => {
    const { client } = fakeClient({
      archived: { clinics: [{ phone: "25202712", is_archived: true }] },
      blank: { clinics: { phone: "  ", is_archived: false } },
    });
    assert.equal(await loadAppointmentClinicPhone(client as never, null), null);
    assert.equal(await loadAppointmentClinicPhone(client as never, "missing"), null);
    assert.equal(await loadAppointmentClinicPhone(client as never, "archived"), null);
    assert.equal(await loadAppointmentClinicPhone(client as never, "blank"), null);
  });
});
